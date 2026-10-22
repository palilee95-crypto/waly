// pb_hooks/nfc_transaction.pb.js
// Endpoint for merchant to confirm bill amount & stamps for an NFC customer claim

routerAdd("POST", "/api/risev/nfc/complete", (e) => {
  try {
    const receiptHelper = require(`${__hooks}/paid_receipt_helper.js`);
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized merchant authentication required" });
    }

    const body = e.requestInfo().body || {};
    const claimId = (body.claim_id || "").trim();
    const billAmount = parseFloat(body.bill_amount) || 0;
    // 0 is a valid amount (a POS sale with no stamps). Only default to 1 when
    // the caller omitted the field entirely.
    const hasStampField = body.stamp_amount !== undefined && body.stamp_amount !== null && String(body.stamp_amount).trim() !== "";
    const stampAmount = hasStampField ? Math.max(0, parseInt(String(body.stamp_amount), 10) || 0) : 1;

    if (!claimId) {
      return e.json(400, { message: "claim_id is required" });
    }

    const claim = $app.findRecordById("nfc_claims", claimId);
    if (!claim) {
      return e.json(404, { message: "NFC claim record not found" });
    }

    const merchantId = claim.getString("merchant");
    const authMerchantId = authRecord.getString ? authRecord.getString("merchant_id") : "";
    let isOwner = false;
    try {
      const merchRec = $app.findRecordById("merchants", merchantId);
      if (merchRec && merchRec.getString("owner") === authRecord.id) {
        isOwner = true;
      }
    } catch (mErr) {}

    const isSuperuser = (authRecord.isSuperuser === true) || 
                        (authRecord.collection && authRecord.collection().name === "_superusers");

    if (!isOwner && authMerchantId !== merchantId && !isSuperuser) {
      return e.json(403, { message: "Forbidden. You are not authorized to confirm claims for this store." });
    }

    if (claim.getString("status") === "completed") {
      let priorReceiptId = "";
      let receiptError = "";
      try {
        // The helper also recognizes a fully discounted voucher sale, whose
        // final bill is RM0.00. Stamp-only claims still return no receipt.
        priorReceiptId = receiptHelper.ensureNfcPaidReceipt(claim, null, null);
      } catch (err) {
        receiptError = "Receipt recovery failed. Please contact support with this claim ID.";
        console.log("[NFC COMPLETE] Receipt recovery failed for", claim.id, err.message || err);
      }
      return e.json(200, { success: true, already_completed: true, receipt_id: priorReceiptId, receipt_error: receiptError });
    }
    if (claim.getString("status") !== "pending") {
      return e.json(409, { message: "This claim is no longer pending." });
    }

    if (billAmount < 0) {
      return e.json(400, { message: "Bill amount cannot be negative." });
    }

    // Fetch loyalty program to know active modes
    const programs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${merchantId}'`, "created", 1, 0);
    let program = programs.length > 0 ? programs[0] : null;
    if (!program) {
      const progCol = $app.findCollectionByNameOrId("loyalty_programs");
      program = new Record(progCol);
      program.set("id", $security.randomString(15).toLowerCase());
      program.set("merchant", merchantId);
      program.set("name", "Standard Loyalty Card");
      program.set("stamp_goal", 10);
      program.set("status", "active");
      program.set("is_active", true);
      program.set("reward_name", "Free Reward");
      program.set("reward_description", "Free reward upon completing stamp card");
      program.set("enable_stamps", true);
      program.set("enable_points", true);
      program.set("spend_per_point", 1);
      $app.save(program);
    }

    const isStampsEnabled = program.get("enable_stamps") !== false;
    const isPointsEnabled = program.get("enable_points") !== false;
    const actualStamps = isStampsEnabled ? stampAmount : 0;

    const minSpend = parseFloat(program.get("min_spend_amount")) || 0;
    if (actualStamps > 0 && minSpend > 0 && billAmount < minSpend) {
      return e.json(400, {
        message: "Bill amount (RM " + billAmount.toFixed(2) + ") is below minimum spend requirement (RM " + minSpend.toFixed(2) + ") to receive stamps."
      });
    }

    if (isStampsEnabled && (stampAmount < 0 || stampAmount > 100)) {
      return e.json(400, { message: "Invalid stamp amount. Must be between 0 and 100." });
    }

    const cleanPhone = claim.getString("customer_phone");
    const customerName = claim.getString("customer_name") || "there";

    // 1. Find or create user by phone
    let customer = null;
    if (cleanPhone) {
      const digits = cleanPhone.replace(/[^\d]/g, '');
      const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
      const phoneFilter = `phone = '${cleanPhone}' || phone = '${digits}' || phone = '${localDigits}'`;
      try {
        const users = $app.findRecordsByFilter("users", phoneFilter, "-created", 1, 0);
        if (users.length > 0) customer = users[0];
      } catch (err) { /* ignore */ }

      if (!customer) {
        try {
          const userCol = $app.findCollectionByNameOrId("users");
          customer = new Record(userCol);
          customer.set("id", $security.randomString(15).toLowerCase());
          customer.set("phone", cleanPhone);
          customer.set("email", `shadow_cust_${cleanPhone.replace(/[^\d]/g, '')}@risev.app`);
          customer.set("name", customerName);
          customer.set("role", "customer");
          customer.set("birthday", "2000-01-01 00:00:00.000Z");
          customer.setPassword($security.randomString(20));
          $app.save(customer);
        } catch (custErr) {
          console.log("[NFC COMPLETE] Failed to auto-create customer user:", custErr.message || custErr);
          customer = null;
        }
      }
    }

    const programId = program.id;
    const goal = parseInt(program.get("stamp_goal")) || 10;

    // Voucher redemption is shared by the walk-in path and the booking checkout.
    const applyVoucher = () => {
      // `voucher_id` present (even empty) is authoritative: the cashier can
      // deliberately remove the customer's pre-selected voucher. Older clients
      // omit the key, so fall back to the voucher stored on the claim.
      const hasVoucherField = Object.prototype.hasOwnProperty.call(body, "voucher_id");
      const voucherId = hasVoucherField
        ? String(body.voucher_id || "").trim()
        : (claim.getString("voucher") || "").trim();
      const outcome = { id: voucherId, code: "", error: "" };
      if (!voucherId) return outcome;

      try {
        let vRec = null;
        try {
          vRec = $app.findRecordById("vouchers", voucherId);
        } catch (e) {
          const byCode = $app.findRecordsByFilter("vouchers", `code = '${voucherId}'`, "-created", 1, 0);
          if (byCode.length > 0) vRec = byCode[0];
        }

        if (!vRec) {
          outcome.error = "not_found";
          return outcome;
        }

        const vStatus = vRec.getString("status");
        const vExpires = vRec.getString("expires_at");

        if (vStatus !== "active") {
          outcome.error = vStatus || "invalid";
        } else if (vExpires && new Date(vExpires.replace(" ", "T")).getTime() <= Date.now()) {
          outcome.error = "expired";
        } else if (customer && vRec.getString("customer") !== customer.id) {
          outcome.error = "wrong_customer";
        } else {
          // Resolve the voucher's merchant before burning it here.
          let vMerchant = "";
          const rewardId = vRec.getString("reward");
          const campaignId = vRec.getString("campaign");
          try {
            if (rewardId) vMerchant = $app.findRecordById("rewards", rewardId).getString("merchant") || "";
          } catch (rwErr) {}
          if (!vMerchant && campaignId) {
            try {
              vMerchant = $app.findRecordById("campaigns", campaignId).getString("merchant") || "";
            } catch (cpErr) {}
          }
          if (!vMerchant) {
            try {
              const rawMeta = vRec.getString("metadata");
              if (rawMeta && rawMeta !== "null") {
                const meta = JSON.parse(rawMeta);
                if (meta && typeof meta === "object") vMerchant = meta.merchant_id || "";
              }
            } catch (metaErr) {}
          }
          if (!vMerchant || vMerchant !== merchantId) {
            outcome.error = "wrong_merchant";
          }
        }

        if (outcome.error) {
          console.log(`[NFC COMPLETE] Voucher ${voucherId} not applied: ${outcome.error}`);
        } else {
          const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
          vRec.set("status", "used");
          vRec.set("used_at", nowIso);
          $app.save(vRec);
          outcome.code = vRec.getString("code");
          console.log("[NFC COMPLETE] Voucher marked as used:", outcome.code || voucherId);
        }
      } catch (vErr) {
        outcome.error = "error";
        console.log("[NFC COMPLETE] Voucher redemption note:", vErr.message || vErr);
      }

      return outcome;
    };

    // A checkout started from a booking carries its id so the booking engine
    // owns the single transaction (stamps, commission and receipt).
    const bookingId = String(body.booking_id || "").trim();
    let activeBooking = null;
    if (bookingId) {
      try {
        activeBooking = $app.findRecordById("service_bookings", bookingId);
      } catch (bErr) {
        return e.json(404, { code: "BOOKING_NOT_FOUND", message: "Booking not found." });
      }
      if (activeBooking.getString("merchant") !== merchantId) {
        return e.json(403, { code: "BOOKING_FORBIDDEN", message: "That booking belongs to another store." });
      }
      const bookingDigits = (activeBooking.getString("customer_phone") || "").replace(/[^\d]/g, "");
      if (bookingDigits && cleanPhone.replace(/[^\d]/g, "") && bookingDigits !== cleanPhone.replace(/[^\d]/g, "")) {
        return e.json(400, { code: "BOOKING_PHONE_MISMATCH", message: "This booking belongs to a different phone number." });
      }
      const bookingStatus = activeBooking.getString("status");
      if (bookingStatus === "completed" || bookingStatus === "cancelled" || bookingStatus === "no_show") {
        return e.json(400, { code: "BOOKING_NOT_ACTIVE", message: "This booking is already " + bookingStatus + "." });
      }
    }

    // Booking checkout: merge the POS cart into the booking and let
    // booking_helper.processCompletedBooking write the transaction.
    if (customer && activeBooking) {
      const voucherOutcome = applyVoucher();
      if (voucherOutcome.error && Number(body.discount_amount) > 0) {
        return e.json(400, { code: "VOUCHER_NOT_APPLIED", message: "Voucher could not be applied: " + voucherOutcome.error });
      }

      const mergedItems = [];
      if (Array.isArray(body.items)) {
        body.items.forEach((rawItem) => {
          if (!rawItem) return;
          const itemName = String(rawItem.name || "").trim();
          if (!itemName) return;
          const entry = {
            id: String(rawItem.id || rawItem.service_id || ""),
            service_id: String(rawItem.service_id || rawItem.id || ""),
            name: itemName,
            price: Number(rawItem.price) || 0,
            qty: Math.max(1, parseInt(rawItem.qty, 10) || 1),
            item_type: String(rawItem.item_type || "service"),
            duration_minutes: Number(rawItem.duration_minutes) || 0,
            commission_type: String(rawItem.commission_type || "none"),
            commission_rate: Number(rawItem.commission_rate) || 0,
          };
          mergedItems.push(entry);
        });
      }

      let bookingMeta = {};
      try {
        const rawBookingMeta = activeBooking.getString("metadata");
        bookingMeta = rawBookingMeta && rawBookingMeta !== "null" ? JSON.parse(rawBookingMeta) : {};
      } catch (metaParseErr) {
        bookingMeta = {};
      }
      if (!bookingMeta || typeof bookingMeta !== "object" || Array.isArray(bookingMeta)) bookingMeta = {};
      bookingMeta.pos_claim_id = claimId;
      bookingMeta.pos_stamps = actualStamps;
      bookingMeta.voucher_id = voucherOutcome.id || "";
      bookingMeta.voucher_code = voucherOutcome.code || "";
      bookingMeta.voucher_error = voucherOutcome.error || "";
      bookingMeta.subtotal = body.subtotal !== undefined ? parseFloat(body.subtotal) || 0 : billAmount;
      bookingMeta.discount_amount = body.discount_amount !== undefined ? parseFloat(body.discount_amount) || 0 : 0;
      bookingMeta.payment_method = String(body.payment_method || "cash");
      bookingMeta.payment_reference = String(body.payment_reference || "").slice(0, 120);

      if (mergedItems.length > 0) {
        activeBooking.set("items_summary", JSON.stringify(mergedItems));
      }
      activeBooking.set("total_price", billAmount);
      activeBooking.set("metadata", JSON.stringify(bookingMeta));

      try {
        const chosenStaffId = String(body.staff_id || "").trim();
        if (chosenStaffId) {
          const staffRec = $app.findRecordById("merchant_staff", chosenStaffId);
          if (staffRec && staffRec.getString("merchant") === merchantId) {
            activeBooking.set("staff", staffRec.id);
          }
        }
      } catch (staffErr) {}

      activeBooking.set("status", "completed");
      // Fires booking_system.pb.js -> processCompletedBooking: one transaction.
      $app.save(activeBooking);

      claim.set("status", "completed");
      claim.set("bill_amount", billAmount);
      claim.set("stamp_amount", actualStamps);
      claim.set("handled_by", authRecord.id);
      claim.set("staff_name", (authRecord.getString("name") || "").trim() || "Staff");
      if (customer) claim.set("customer", customer.id);
      claim.set("completed_at", new Date().toISOString().replace('T', ' ').substring(0, 19));
      $app.save(claim);

      let bookingReceiptId = "";
      let bookingReceiptError = "";
      try {
        const bookingReceipts = $app.findRecordsByFilter("digital_receipts", "booking = '" + activeBooking.id + "'", "-created", 1, 0);
        bookingReceiptId = bookingReceipts.length ? bookingReceipts[0].id : "";
        if (!bookingReceiptId && (billAmount > 0 || (voucherOutcome.id && !voucherOutcome.error))) {
          bookingReceiptId = receiptHelper.ensureNfcPaidReceipt(claim, null, null);
        }
      } catch (receiptLookupErr) {
        bookingReceiptError = "Payment was recorded, but the receipt could not be saved. Retry the receipt from this sale.";
        console.log("[NFC COMPLETE] Booking receipt recovery failed:", receiptLookupErr.message || receiptLookupErr);
      }

      console.log(`[NFC COMPLETE] Booking ${activeBooking.id} checked out via POS (claim ${claimId}) for RM${billAmount}, ${actualStamps} stamp(s)`);

      return e.json(200, {
        success: true,
        message: "Booking completed",
        booking_id: activeBooking.id,
        completed_via: "pos",
        receipt_id: bookingReceiptId,
        receipt_error: bookingReceiptError,
        voucher_error: voucherOutcome.error || "",
        voucher_code: voucherOutcome.code || "",
      });
    }

    const voucherOutcome = applyVoucher();
    if (voucherOutcome.error && Number(body.discount_amount) > 0) {
      return e.json(400, { code: "VOUCHER_NOT_APPLIED", message: "Voucher could not be applied: " + voucherOutcome.error });
    }

    // 3. Find or create loyalty card & add stamps
    let card = null;
    if (customer) {
      try {
        const cards = $app.findRecordsByFilter("loyalty_cards", `program = '${programId}' && customer = '${customer.id}'`, "created", 1, 0);
        if (cards.length > 0) card = cards[0];
      } catch (err) { /* no card yet */ }

      if (!card) {
        const cardCol = $app.findCollectionByNameOrId("loyalty_cards");
        card = new Record(cardCol);
        card.set("id", $security.randomString(15).toLowerCase());
        card.set("program", programId);
        card.set("customer", customer.id);
        card.set("merchant", merchantId);
        card.set("stamps_collected", 0);
        card.set("status", "active");
        card.set("opt_in_marketing", true);
        card.set("completions", 0);
      }

      const currentStamps = parseInt(card.get("stamps_collected")) || parseInt(card.get("stamps")) || 0;
      const totalStamps = isStampsEnabled ? (currentStamps + actualStamps) : currentStamps;
      if (isStampsEnabled) {
        card.set("stamps_collected", totalStamps);
      }
      card.set("last_activity", new Date().toISOString().replace('T', ' ').substring(0, 19));
      $app.save(card);

      // 4. Record transaction & Process optional Voucher redemption
      const staffId = authRecord.id;
      const staffName = (authRecord.getString("name") || "").trim() || (authRecord.getString("phone") ? "Staff (" + authRecord.getString("phone").slice(-4) + ")" : "Staff");
      const branchName = (body.branch_name || authRecord.getString("branch_name") || claim.getString("branch_name") || "All Branches (HQ)").trim();
      const branchId = (body.branch_id || authRecord.getString("branch") || claim.getString("branch") || "").trim();
      const voucherId = voucherOutcome.id;
      const redeemedVoucherCode = voucherOutcome.code;
      const voucherError = voucherOutcome.error;

      let transactionId = "";
      try {
        function resolveBranchId(mid, candidate) {
          if (!candidate) return "";
          try {
            const b = $app.findRecordById("branches", candidate);
            if (b && b.getString("merchant") === mid) return b.id;
          } catch (e) {}
          return "";
        }

        const txnCol = $app.findCollectionByNameOrId("transactions");
        const txn = new Record(txnCol);
        txn.set("id", $security.randomString(15).toLowerCase());
        txn.set("type", "earn");
        txn.set("stamps", actualStamps);
        txn.set("bill_amount", billAmount);
        txn.set("customer", customer.id);
        txn.set("merchant", merchantId);
        txn.set("loyalty_card", card.id);
        txn.set("staff", staffId);
        txn.set("branch", resolveBranchId(merchantId, branchId));
        const txnMeta = {
          source: "nfc_claim",
          claim_id: claimId,
          staff_id: staffId,
          staff_name: staffName,
          branch_name: branchName,
          branch_id: branchId,
          voucher_id: voucherId || "",
          voucher_code: redeemedVoucherCode || "",
          voucher_error: voucherError || "",
          subtotal: body.subtotal ? parseFloat(body.subtotal) : billAmount,
          discount_amount: body.discount_amount ? parseFloat(body.discount_amount) : 0,
          payment_method: String(body.payment_method || "cash"),
          payment_reference: String(body.payment_reference || "").slice(0, 120),
          items: Array.isArray(body.items) ? body.items.slice(0, 100).map((item) => ({ name: String(item.name || "Item").slice(0, 120), qty: Math.max(1, parseInt(item.qty, 10) || 1), price: Math.max(0, Number(item.price) || 0) })) : [],
        };
        txn.set("metadata", JSON.stringify(txnMeta));
        $app.save(txn);
        transactionId = txn.id;
      } catch (txnErr) {
        console.log("[NFC COMPLETE] Transaction error:", txnErr.message || txnErr);
      }

      // The paid receipt is a server-owned snapshot of this exact POS claim.
      // A stamp-only approval (zero bill, no voucher) remains a loyalty event,
      // but a voucher can legitimately cover the whole bill and still needs a
      // receipt showing the discount and RM0.00 total.
      const voucherSale = Boolean(voucherOutcome.id) && !voucherOutcome.error;
      const hasSaleValue = billAmount > 0 ||
        (voucherSale && (Number(body.subtotal) > 0 || (Array.isArray(body.items) && body.items.length > 0)));
      let receiptId = "";
      let receiptError = "";
      if (hasSaleValue && transactionId) {
        try {
          receiptId = receiptHelper.ensureNfcPaidReceipt(claim, $app.findRecordById("transactions", transactionId), body);
        } catch (receiptErr) {
          console.log("[NFC COMPLETE] Paid receipt error:", receiptErr.message || receiptErr);
          receiptError = "Payment was recorded, but the receipt could not be saved. Retry the receipt from this sale.";
        }
      } else if (hasSaleValue) {
        receiptError = "Payment was recorded, but its transaction was not saved. Contact support with this claim ID.";
      }

      // 5. Update nfc_claim record to completed
      claim.set("status", "completed");
      claim.set("bill_amount", billAmount);
      claim.set("stamp_amount", actualStamps);
      claim.set("handled_by", staffId);
      claim.set("staff_name", staffName);
      if (customer) claim.set("customer", customer.id);
      claim.set("completed_at", new Date().toISOString().replace('T', ' ').substring(0, 19));
      $app.save(claim);

      // 6. Transaction completed - welcome_notification.pb.js handles sending the WhatsApp receipt
      console.log(`[NFC COMPLETE] Completed claim for customer ${customerName} (${cleanPhone}), total stamps: ${totalStamps}/${goal}`);

      return e.json(200, {
        success: true,
        message: "Stamps issued successfully",
        totalStamps: totalStamps,
        goal: goal,
        voucher_error: voucherError || "",
        voucher_code: redeemedVoucherCode || "",
        receipt_id: receiptId,
        receipt_error: receiptError
      });
    }

    return e.json(400, { message: "Failed to process customer for NFC claim" });
  } catch (err) {
    return e.json(500, { message: "Failed to complete NFC claim: " + (err.message || err) });
  }
});
