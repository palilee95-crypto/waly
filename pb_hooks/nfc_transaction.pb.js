// pb_hooks/nfc_transaction.pb.js
// Endpoint for merchant to confirm bill amount & stamps for an NFC customer claim

routerAdd("POST", "/api/risev/nfc/complete", (e) => {
  try {
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

    if (claim.getString("status") === "completed") {
      return e.json(400, { message: "NFC claim has already been completed" });
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
      // `voucher_id` present (even empty) is authoritative: the cashier can
      // deliberately remove the customer's pre-selected voucher. Older clients
      // omit the key, so fall back to the voucher stored on the claim.
      const hasVoucherField = Object.prototype.hasOwnProperty.call(body, "voucher_id");
      const voucherId = hasVoucherField
        ? String(body.voucher_id || "").trim()
        : (claim.getString("voucher") || "").trim();
      let redeemedVoucherCode = "";
      let voucherError = "";

      if (voucherId) {
        try {
          let vRec = null;
          try {
            vRec = $app.findRecordById("vouchers", voucherId);
          } catch (e) {
            const byCode = $app.findRecordsByFilter("vouchers", `code = '${voucherId}'`, "-created", 1, 0);
            if (byCode.length > 0) vRec = byCode[0];
          }

          if (!vRec) {
            voucherError = "not_found";
          } else {
            const vStatus = vRec.getString("status");
            const vExpires = vRec.getString("expires_at");

            if (vStatus !== "active") {
              voucherError = vStatus || "invalid";
            } else if (vExpires && new Date(vExpires.replace(" ", "T")).getTime() <= Date.now()) {
              voucherError = "expired";
            } else if (customer && vRec.getString("customer") !== customer.id) {
              voucherError = "wrong_customer";
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
                voucherError = "wrong_merchant";
              }
            }

            if (voucherError) {
              console.log(`[NFC COMPLETE] Voucher ${voucherId} not applied: ${voucherError}`);
            } else {
              const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
              vRec.set("status", "used");
              vRec.set("used_at", nowIso);
              $app.save(vRec);
              redeemedVoucherCode = vRec.getString("code");
              console.log("[NFC COMPLETE] Voucher marked as used:", redeemedVoucherCode || voucherId);
            }
          }
        } catch (vErr) {
          voucherError = "error";
          console.log("[NFC COMPLETE] Voucher redemption note:", vErr.message || vErr);
        }
      }

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
        };
        txn.set("metadata", JSON.stringify(txnMeta));
        $app.save(txn);
      } catch (txnErr) {
        console.log("[NFC COMPLETE] Transaction error:", txnErr.message || txnErr);
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
        voucher_code: redeemedVoucherCode || ""
      });
    }

    return e.json(400, { message: "Failed to process customer for NFC claim" });
  } catch (err) {
    return e.json(500, { message: "Failed to complete NFC claim: " + (err.message || err) });
  }
});
