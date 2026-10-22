// pb_hooks/nfc_request.pb.js
// Endpoint for customer to submit an NFC stamp claim request directly via web

routerAdd("POST", "/api/risev/nfc/request", (e) => {
  try {
    const body = e.requestInfo().body || {};
    const merchantId = (body.merchant_id || body.merchant || "").trim();
    let rawPhone = (body.phone || body.customer_phone || "").trim();
    let name = (body.name || body.customer_name || "").trim();
    let branchId = (body.branch_id || body.branch || "").trim();
    let branchName = (body.branch_name || "").trim();
    const isManualPos = body.manual_pos === true || body.manual_pos === "true" ||
      body.manual_pos === 1 || body.manual_pos === "1";

    if (!merchantId) {
      return e.json(400, { message: "merchant_id is required" });
    }
    if (!rawPhone) {
      return e.json(400, { message: "customer phone number is required" });
    }

    // Verify merchant exists
    let merchant = null;
    try {
      merchant = $app.findRecordById("merchants", merchantId);
    } catch (err) {
      return e.json(404, { message: "Merchant not found" });
    }

    // POS is a paid-plan feature and must be initiated by the merchant or its
    // staff. The customer flow below stays public; only manual_pos is gated.
    let bookingBypass = false;
    let checkoutBookingId = "";
    if (isManualPos) {
      const auth = e.auth;
      if (!auth) {
        return e.json(401, { code: "POS_AUTH_REQUIRED", message: "Please sign in to use the POS System." });
      }
      let isMerchantOwner = false;
      try {
        isMerchantOwner = merchant.getString("owner") === auth.id;
      } catch (ownerErr) {}
      const authMerchantId = auth.getString ? (auth.getString("merchant_id") || "") : "";
      const isSuperuser = auth.isSuperuser === true ||
        (auth.collection && auth.collection().name === "_superusers");
      if (!isMerchantOwner && authMerchantId !== merchantId && !isSuperuser) {
        return e.json(403, { code: "POS_FORBIDDEN", message: "You are not authorized to start a POS sale for this store." });
      }

      let posPlan = "";
      try {
        const posSubs = $app.findRecordsByFilter("subscriptions", `merchant = '${merchantId}' && status = 'active'`, "-created", 1, 0);
        if (posSubs.length > 0) {
          const periodEnd = posSubs[0].getString("current_period_end");
          if (!periodEnd || new Date(periodEnd).getTime() > Date.now()) {
            posPlan = (posSubs[0].getString("plan") || "").toLowerCase();
          }
        }
      } catch (posSubErr) {}

      // A booking checkout is already covered by the booking add-on, so a manual
      // POS sale that carries a valid booking id is allowed on any plan. Without
      // a valid booking id the POS plan gate below still applies.
      checkoutBookingId = String(body.booking_id || "").trim();
      if (checkoutBookingId) {
        try {
          const digitsOf = (value) => String(value || "").replace(/[^\d]/g, "");
          const booking = $app.findRecordById("service_bookings", checkoutBookingId);
          const bookingStatus = booking.getString("status");
          bookingBypass = booking.getString("merchant") === merchantId &&
            ["booked", "arrived", "in_service"].indexOf(bookingStatus) >= 0 &&
            digitsOf(booking.getString("customer_phone")) === digitsOf(rawPhone);
        } catch (bookingErr) {
          bookingBypass = false;
        }
      }

      if (!bookingBypass && ["starter", "pro", "business", "enterprise"].indexOf(posPlan) < 0) {
        return e.json(403, {
          code: "POS_PLAN_REQUIRED",
          message: "The POS System is available on Starter and PRO plans."
        });
      }
    }

    // Resolve branch name if branchId is provided
    if (branchId && !branchName) {
      try {
        const bRec = $app.findRecordById("branches", branchId);
        if (bRec) branchName = bRec.getString("name") || "";
      } catch (bErr) {}
    }

    // If no branch specified, fallback to merchant's HQ branch
    if (!branchId) {
      try {
        const hqs = $app.findRecordsByFilter("branches", `merchant = '${merchantId}' && is_hq = true`, "-created", 1, 0);
        if (hqs.length > 0) {
          branchId = hqs[0].id;
          branchName = hqs[0].getString("name") || "HQ / Main Outlet";
        }
      } catch (hqErr) {}
    }

    // Format phone number
    let digits = rawPhone.replace(/[^\d]/g, '');
    if (digits.indexOf("0") === 0) digits = "6" + digits;
    if (digits.indexOf("60") !== 0 && digits.length >= 9) digits = "60" + digits;
    const cleanPhone = "+" + digits;
    if (isManualPos && !/^601\d{8,9}$/.test(digits)) {
      return e.json(400, { code: "POS_PHONE_INVALID", message: "Enter a valid Malaysian mobile number before checkout." });
    }

    // Check if customer user record already exists
    let customerUser = null;
    if (digits) {
      const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
      const phoneFilter = `phone = '${cleanPhone}' || phone = '${digits}' || phone = '${localDigits}'`;
      try {
        const users = $app.findRecordsByFilter("users", phoneFilter, "-created", 1, 0);
        if (users.length > 0) {
          customerUser = users[0];
          const regName = (customerUser.getString("name") || "").trim();
          if (regName && !regName.startsWith("Customer ")) {
            name = regName;
          }
        }
      } catch (err) { /* ignore */ }
    }

    if (!name) {
      name = "Customer " + digits.slice(-4);
    }

    const reqVoucherId = (body.voucher_id || body.voucher || "").trim();
    let voucherTitle = (body.voucher_name || body.voucher_title || "").trim();
    let voucher = null;
    let voucherError = "";

    // Validate the customer's pre-selected voucher BEFORE attaching it.
    // A bad voucher must never block the stamp claim itself.
    if (reqVoucherId) {
      try {
        voucher = $app.findRecordById("vouchers", reqVoucherId);
      } catch (idErr) {
        try {
          const byCode = $app.findRecordsByFilter("vouchers", `code = '${reqVoucherId}'`, "-created", 1, 0);
          if (byCode.length > 0) voucher = byCode[0];
        } catch (codeErr) {}
      }

      if (!voucher) {
        voucherError = "not_found";
      } else {
        const vStatus = voucher.getString("status");
        const vExpires = voucher.getString("expires_at");
        if (vStatus !== "active") {
          voucherError = (vStatus === "used" || vStatus === "expired" || vStatus === "voided") ? vStatus : "invalid";
        } else if (vExpires && new Date(vExpires.replace(" ", "T")).getTime() <= Date.now()) {
          voucherError = "expired";
        } else if (!customerUser || voucher.getString("customer") !== customerUser.id) {
          voucherError = "wrong_customer";
        } else {
          // Resolve the voucher's merchant: reward, then campaign, then metadata.
          let vMerchant = "";
          const rewardId = voucher.getString("reward");
          const campaignId = voucher.getString("campaign");
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
              const rawMeta = voucher.getString("metadata");
              if (rawMeta && rawMeta !== "null") {
                const meta = JSON.parse(rawMeta);
                if (meta && typeof meta === "object") vMerchant = meta.merchant_id || "";
              }
            } catch (metaErr) {}
          }

          if (!vMerchant || vMerchant !== merchantId) {
            voucherError = "wrong_merchant";
          } else {
            if (!voucherTitle) {
              try {
                if (rewardId) voucherTitle = $app.findRecordById("rewards", rewardId).getString("name") || "";
              } catch (t1Err) {}
            }
            if (!voucherTitle && campaignId) {
              try {
                voucherTitle = $app.findRecordById("campaigns", campaignId).getString("name") || "";
              } catch (t2Err) {}
            }
            if (!voucherTitle) {
              try {
                const rawMeta = voucher.getString("metadata");
                if (rawMeta && rawMeta !== "null") {
                  const meta = JSON.parse(rawMeta);
                  if (meta && typeof meta === "object") voucherTitle = meta.snapshot_title || "";
                }
              } catch (t3Err) {}
            }
            if (!voucherTitle) voucherTitle = "Reward Voucher";
          }
        }
      }

      if (voucherError) {
        console.log(`[NFC REQUEST] Rejected voucher ${reqVoucherId}: ${voucherError}`);
        voucher = null;
        voucherTitle = "";
      }
    }

    const appliedVoucherId = voucher ? voucher.id : "";
    if (appliedVoucherId && !name.includes("[VOUCHER:")) {
      name = `${name} [VOUCHER:${appliedVoucherId}#${voucherTitle}]`;
    }

    // Generate random 6-character uppercase session code
    const sessionCode = $security.randomString(6).toUpperCase();

    // Customer NFC requests may reuse their own pending claim. Manual POS
    // checkouts always get a fresh claim so they cannot overwrite an NFC
    // request (or a different sale for the same customer).
    let claim = null;

    // A booking-exempt manual claim is reused for the same booking, so one
    // booking cannot open several exemption claims.
    if (isManualPos && bookingBypass && checkoutBookingId) {
      try {
        const existingBypass = $app.findRecordsByFilter(
          "nfc_claims",
          `merchant = '${merchantId}' && booking = '${checkoutBookingId}' && status = 'pending'`,
          "-created",
          1,
          0
        );
        if (existingBypass.length > 0) {
          claim = existingBypass[0];
          claim.set("customer_name", name);
          claim.set("customer_phone", cleanPhone);
          claim.set("session_code", sessionCode);
          claim.set("status", "pending");
          if (branchId) claim.set("branch", branchId);
          if (branchName) claim.set("branch_name", branchName);
          $app.save(claim);
          console.log(`[NFC REQUEST] Reused booking claim ${claim.id} for booking ${checkoutBookingId}`);
        }
      } catch (bypassErr) {
        claim = null;
      }
    }

    if (!isManualPos) try {
      const existingClaims = $app.findRecordsByFilter(
        "nfc_claims",
        `merchant = '${merchantId}' && customer_phone = '${cleanPhone}' && manual_pos = false && (status = 'draft' || status = 'pending')`,
        "-created",
        1,
        0
      );
      if (existingClaims.length > 0) {
        claim = existingClaims[0];
        // Reuse existing claim record, update name and session_code
        claim.set("customer_name", name);
        claim.set("session_code", sessionCode);
        claim.set("status", "pending");
        if (branchId) claim.set("branch", branchId);
        if (branchName) claim.set("branch_name", branchName);
        if (customerUser) claim.set("customer", customerUser.id);
        // A POS sale is not a customer stamp request; flag it so the dashboard
        // does not list it and the merchant is not pushed about their own sale.
        try { claim.set("manual_pos", isManualPos); } catch (vErr) {}
        // Always set or clear the voucher on reuse so a stale request can't persist.
        try {
          claim.set("voucher", appliedVoucherId || "");
          claim.set("voucher_title", appliedVoucherId ? voucherTitle : "");
        } catch (vErr) {}
        $app.save(claim);
        console.log(`[NFC REQUEST] Updated existing claim ${claim.id} to pending for merchant ${merchantId}, branch ${branchName}, phone ${cleanPhone}`);
      }
    } catch (err) { /* create new below */ }

    if (!claim) {
      const claimCol = $app.findCollectionByNameOrId("nfc_claims");
      claim = new Record(claimCol);
      claim.set("id", $security.randomString(15).toLowerCase());
      claim.set("merchant", merchantId);
      claim.set("customer_phone", cleanPhone);
      claim.set("customer_name", name);
      claim.set("session_code", sessionCode);
      claim.set("status", "pending");
      if (branchId) claim.set("branch", branchId);
      if (branchName) claim.set("branch_name", branchName);
      if (customerUser) claim.set("customer", customerUser.id);
      try { claim.set("manual_pos", isManualPos); } catch (vErr) {}
      // Bind an exempt claim to the booking that justified it. /nfc/complete
      // requires this booking id back before it will settle the sale.
      if (bookingBypass && checkoutBookingId) {
        try { claim.set("booking", checkoutBookingId); } catch (bookErr) {
          console.log("[NFC REQUEST] Could not bind booking to claim:", bookErr.message || bookErr);
        }
      }
      if (appliedVoucherId) {
        try { claim.set("voucher", appliedVoucherId); } catch (vErr) {}
        try { claim.set("voucher_title", voucherTitle); } catch (vErr) {}
      }
      $app.save(claim);
      console.log(`[NFC REQUEST] Created new pending claim ${claim.id} for merchant ${merchantId}, branch ${branchName}, phone ${cleanPhone}`);
    }

    // Trigger Web Push Notification to Merchant Owner & Branch Staff.
    // Skip it for a POS sale — the merchant just started the claim themselves.
    if (!isManualPos) {
      try {
        const pushHelper = require(`${__hooks}/push_notify.js`);
        pushHelper.sendPushToMerchant(merchantId, branchId, {
          title: appliedVoucherId ? "NFC Claim + Baucar! 🏷️🎁" : "NFC Stamp Claim! 🏷️",
          body: appliedVoucherId
            ? `${name} ingin kumpul cop & tebus: ${voucherTitle}`
            : `${name} wants to claim stamps${branchName ? ' (' + branchName + ')' : ''}`,
          url: `/(merchant)/give?claim_id=${claim.id}&phone=${encodeURIComponent(cleanPhone)}`,
          tag: `claim-${claim.id}`,
          data: {
            claim_id: claim.id,
            customer_name: name,
            phone: cleanPhone,
            session_code: sessionCode,
            voucher_id: appliedVoucherId,
            voucher_name: voucherTitle
          }
        });
      } catch (pushErr) {
        console.log("[NFC CLAIM PUSH DISPATCH ERROR]", pushErr.message || pushErr);
      }
    }

    // Find current stamps for this customer & merchant if already registered
    let currentStamps = 0;
    let stampGoal = 10;
    try {
      const programs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${merchantId}'`, "-created", 1, 0);
      if (programs.length > 0) stampGoal = programs[0].getInt("stamp_goal") || 10;
      if (customerUser) {
        const cards = $app.findRecordsByFilter("loyalty_cards", `merchant = '${merchantId}' && customer = '${customerUser.id}' && status = 'active'`, "-created", 1, 0);
        if (cards.length > 0) currentStamps = cards[0].getInt("stamps_collected") || 0;
      }
    } catch (err) {}

    return e.json(200, {
      success: true,
      claim_id: claim.id,
      session_code: sessionCode,
      status: "pending",
      current_stamps: currentStamps,
      stamp_goal: stampGoal,
      merchant_name: merchant.getString("name") || "Merchant",
      voucher_id: appliedVoucherId,
      voucher_name: voucherTitle,
      voucher_error: voucherError,
      manual_pos: isManualPos
    });
  } catch (err) {
    console.log("[NFC REQUEST ERROR]", err.message || err);
    return e.json(500, { message: "Failed to submit NFC claim request: " + (err.message || err) });
  }
});

// Endpoint called when customer clicks/opens WhatsApp to activate claim for merchant terminal
routerAdd("POST", "/api/risev/nfc/whatsapp-sent", (e) => {
  try {
    const body = e.requestInfo().body || {};
    const claimId = (body.claim_id || body.id || "").trim();

    if (!claimId) {
      return e.json(400, { message: "claim_id is required" });
    }

    const claim = $app.findRecordById("nfc_claims", claimId);
    claim.set("status", "pending"); // Now ready for merchant terminal approval!
    $app.save(claim);

    // Trigger Web Push Notification
    try {
      const pushHelper = require(`${__hooks}/push_notify.js`);
      const mid = claim.getString("merchant");
      const bid = claim.getString("branch");
      const cName = claim.getString("customer_name") || "Customer";
      const bName = claim.getString("branch_name") || "";
      const cPhone = claim.getString("customer_phone") || "";
      pushHelper.sendPushToMerchant(mid, bid, {
        title: "NFC Stamp Claim! 🏷️",
        body: `${cName} wants to claim stamps${bName ? ' (' + bName + ')' : ''}`,
        url: `/(merchant)/give?claim_id=${claim.id}&phone=${encodeURIComponent(cPhone)}`,
        tag: `claim-${claim.id}`,
        data: {
          claim_id: claim.id,
          customer_name: cName,
          phone: cPhone,
          session_code: claim.getString("session_code")
        }
      });
    } catch (pushErr) {}

    console.log(`[NFC WHATSAPP SENT] Claim ${claimId} marked as pending (ready for merchant approval).`);
    return e.json(200, { success: true, status: "pending", claim_id: claimId });
  } catch (err) {
    console.log("[NFC WHATSAPP SENT ERROR]", err.message || err);
    return e.json(500, { message: err.message || "Failed to update claim" });
  }
});

// Endpoint to check NFC claim status without customer authentication
routerAdd("GET", "/api/risev/nfc/claim-status", (e) => {
  try {
    let query = {};
    try {
      query = e.requestInfo().query || {};
    } catch (qErr) {}
    const claimId = (query.claim_id || "").trim();

    if (!claimId) {
      return e.json(400, { message: "claim_id is required" });
    }

    const claim = $app.findRecordById("nfc_claims", claimId);
    if (!claim) {
      return e.json(404, { message: "Claim not found" });
    }

    const merchantId = claim.getString("merchant");
    const status = claim.getString("status");
    let totalStamps = 0;
    let stampGoal = 10;

    try {
      const programs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${merchantId}'`, "-created", 1, 0);
      if (programs.length > 0) stampGoal = programs[0].getInt("stamp_goal") || 10;

      const customerId = claim.getString("customer");
      if (customerId) {
        const cards = $app.findRecordsByFilter("loyalty_cards", `merchant = '${merchantId}' && customer = '${customerId}'`, "-created", 1, 0);
        if (cards.length > 0) totalStamps = cards[0].getInt("stamps_collected") || 0;
      }
    } catch (err) {}

    let earnedVoucher = null;
    const customerId = claim.getString("customer");
    if (status === "completed" && customerId) {
      try {
        const recentVouchers = $app.findRecordsByFilter(
          "vouchers",
          `customer = '${customerId}' && status = 'active'`,
          "-created",
          1,
          0
        );
        if (recentVouchers.length > 0) {
          const v = recentVouchers[0];
          const vCreated = new Date(v.getString("created") || v.get("created")).getTime();
          const claimCompletedAt = claim.getString("completed_at") ? new Date(claim.getString("completed_at")).getTime() : Date.now();
          if (Math.abs(Date.now() - vCreated) < 180000 || Math.abs(claimCompletedAt - vCreated) < 180000) {
            let meta = {};
            try {
              const rawMeta = v.getString("metadata") || v.get("metadata");
              meta = typeof rawMeta === "string" ? JSON.parse(rawMeta) : (rawMeta || {});
            } catch (mErr) {}

            let rewardTitle = meta.snapshot_title || "";
            if (!rewardTitle && v.getString("reward")) {
              try {
                const rw = $app.findRecordById("rewards", v.getString("reward"));
                if (rw) rewardTitle = rw.getString("name") || rw.getString("title") || "";
              } catch (rErr) {}
            }

            earnedVoucher = {
              id: v.id,
              code: v.getString("code"),
              title: rewardTitle || "Exclusive Reward Voucher",
              description: meta.snapshot_description || "",
              is_sub_reward: meta.is_sub_reward === true,
              at_stamp: meta.at_stamp || null,
              discount_value: meta.discount_value || 0,
              snapshot_type: meta.snapshot_type || "free_item",
              expires_at: v.getString("expires_at") || "",
            };
          }
        }
      } catch (vErr) {}
    }

    return e.json(200, {
      success: true,
      claim_id: claim.id,
      status: status,
      stamp_amount: claim.getInt("stamp_amount") || 0,
      total_stamps: totalStamps,
      stamp_goal: stampGoal,
      customer_name: claim.getString("customer_name"),
      earned_voucher: earnedVoucher
    });
  } catch (err) {
    return e.json(500, { message: err.message || "Failed to get claim status" });
  }
});

// Resolve only the paid receipt tied to this customer's exact NFC claim. Guest
// sessions present the phone used for that claim; signed-in customers may use
// their own account instead. Never search by newest merchant/phone receipt.
routerAdd("GET", "/api/risev/nfc/receipt", (e) => {
  try {
    const query = e.requestInfo().query || {};
    const claimId = String(query.claim_id || "").trim();
    if (!/^[a-z0-9]{15}$/.test(claimId)) return e.json(400, { message: "Invalid claim" });
    const claim = $app.findRecordById("nfc_claims", claimId);
    if (claim.getString("status") !== "completed") return e.json(200, { receipt_id: "", paid_sale: false });
    // Same canonical form the claim was created with: a customer may type
    // "+60…", "0…" or just the subscriber number ("126140423"), and all three
    // must match the stored phone.
    const digits = (value) => {
      let result = String(value || "").replace(/[^\d]/g, "");
      if (!result) return "";
      if (result.indexOf("0") === 0) result = "6" + result;
      if (result.indexOf("60") !== 0 && result.length >= 9) result = "60" + result;
      return result;
    };
    const requestedPhone = digits(query.phone);
    const claimPhone = digits(claim.getString("customer_phone"));
    const accountMatches = !!(e.auth && claim.getString("customer") && e.auth.id === claim.getString("customer"));
    if (!accountMatches && (!requestedPhone || requestedPhone !== claimPhone)) {
      return e.json(403, { message: "This receipt belongs to another customer" });
    }
    const receipts = $app.findRecordsByFilter("digital_receipts", "claim = '" + claimId + "'", "-created", 1, 0);
    const receipt = receipts.length ? receipts[0] : null;
    if (!receipt || receipt.getString("payment_status") !== "paid") {
      return e.json(200, { receipt_id: "", paid_sale: Number(claim.get("bill_amount")) > 0 });
    }
    // A voucher can cover the whole bill; the receipt still exists as a paid
    // record with a RM0.00 total and the voucher discount.
    return e.json(200, {
      receipt_id: receipt.id,
      share_token: receipt.getString("share_token"),
      paid_sale: true
    });
  } catch (err) {
    return e.json(404, { message: "Receipt not found" });
  }
});

// Customer history resolves a receipt through its ledger transaction only for
// the signed-in owner of that transaction.
routerAdd("GET", "/api/risev/customer/transaction-receipt", (e) => {
  try {
    if (!e.auth) return e.json(401, { message: "Sign in to view transaction receipts" });
    const query = e.requestInfo().query || {};
    const transactionId = String(query.transaction_id || "").trim();
    if (!/^[a-z0-9]{15}$/.test(transactionId)) return e.json(400, { message: "Invalid transaction" });
    const transaction = $app.findRecordById("transactions", transactionId);
    if (transaction.getString("customer") !== e.auth.id) return e.json(403, { message: "This transaction belongs to another customer" });
    const receipts = $app.findRecordsByFilter("digital_receipts", "transaction = '" + transactionId + "'", "-created", 1, 0);
    const receipt = receipts.length ? receipts[0] : null;
    if (!receipt) return e.json(200, { receipt_id: "", share_token: "" });

    // Same rule as the public route: a paid receipt may be RM0.00 (voucher), a
    // "recorded" one only counts when money actually changed hands.
    const status = receipt.getString("payment_status");
    const total = Number(receipt.get("total_amount")) || 0;
    const usable = status === "paid" || (status === "recorded" && total > 0);
    return e.json(200, {
      receipt_id: usable ? receipt.id : "",
      share_token: usable ? receipt.getString("share_token") : ""
    });
  } catch (err) { return e.json(404, { message: "Transaction not found" }); }
});

// Endpoint to check customer's active vouchers for this merchant before claiming
routerAdd("POST", "/api/risev/nfc/customer-vouchers", (e) => {
  try {
    const body = e.requestInfo().body || {};
    const merchantId = (body.merchant_id || body.merchant || "").trim();
    const rawPhone = (body.phone || body.customer_phone || "").trim();

    if (!merchantId) {
      return e.json(200, { success: true, vouchers: [] });
    }

    let digits = rawPhone.replace(/[^\d]/g, '');
    if (digits.indexOf("0") === 0) digits = "6" + digits;
    if (digits.indexOf("60") !== 0 && digits.length >= 9) digits = "60" + digits;
    const cleanPhone = digits ? "+" + digits : "";
    const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;

    // 1. Prefer the authenticated customer; fall back to phone (guest flow).
    let customerId = "";
    try {
      const auth = e.auth;
      if (auth && (auth.collectionId === "_pb_users_auth_" || (auth.collection && auth.collection().name === "users"))) {
        customerId = auth.id;
      }
    } catch (authErr) {}

    if (!customerId && digits) {
      try {
        const users = $app.findRecordsByFilter(
          "users",
          `phone = '${cleanPhone}' || phone = '${digits}' || phone = '${localDigits}'`,
          "-created",
          1,
          0
        );
        if (users.length > 0) customerId = users[0].id;
      } catch (uErr) {}
    }

    if (!customerId) {
      return e.json(200, { success: true, vouchers: [] });
    }

    // 2. Active vouchers only. Expiry is checked in JS so an unset date and a
    //    past date are handled the same way everywhere.
    const nowMs = Date.now();
    let rawVouchers = [];
    try {
      rawVouchers = $app.findRecordsByFilter(
        "vouchers",
        `customer = '${customerId}' && status = 'active'`,
        "-created",
        100,
        0
      );
    } catch (vErr) {
      return e.json(200, { success: true, vouchers: [] });
    }

    const result = [];
    for (let i = 0; i < rawVouchers.length; i++) {
      const v = rawVouchers[i];

      let meta = {};
      try {
        const rawMeta = v.getString("metadata");
        if (rawMeta && rawMeta !== "null") {
          const parsed = JSON.parse(rawMeta);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed;
        }
      } catch (mErr) {}

      const expiresAt = v.getString("expires_at") || "";
      if (expiresAt) {
        const expMs = new Date(expiresAt.replace(" ", "T")).getTime();
        if (Number.isFinite(expMs) && expMs <= nowMs) continue;
      }

      const rewardId = v.getString("reward");
      const campaignId = v.getString("campaign");
      let voucherMerchantId = "";
      let title = meta.snapshot_title || "";
      let description = meta.snapshot_description || "";
      let type = meta.snapshot_type || "free_item";

      if (rewardId) {
        try {
          const rw = $app.findRecordById("rewards", rewardId);
          if (rw) {
            voucherMerchantId = rw.getString("merchant") || "";
            if (!title) title = rw.getString("name") || "";
            if (!description) description = rw.getString("description") || "";
            if (rw.getString("type")) type = rw.getString("type");
          }
        } catch (rErr) {}
      }

      if (!voucherMerchantId && campaignId) {
        try {
          const cp = $app.findRecordById("campaigns", campaignId);
          if (cp) {
            voucherMerchantId = cp.getString("merchant") || "";
            if (!title) title = cp.getString("name") || "";
            if (!description) description = cp.getString("description") || "";
          }
        } catch (cErr) {}
      }

      if (!voucherMerchantId && meta.merchant_id) {
        voucherMerchantId = meta.merchant_id;
      }

      // Strict: only vouchers clearly issued by this merchant.
      if (voucherMerchantId !== merchantId) continue;

      result.push({
        id: v.id,
        code: v.getString("code") || "",
        title: title || "Reward Voucher",
        description: description || "",
        type: type,
        discount_type: meta.discount_type || "",
        discount_value: Number(meta.discount_value) || 0,
        min_spend: Number(meta.min_spend) || 0,
        max_discount: Number(meta.max_discount) || 0,
        applicable_items_text: meta.applicable_items_text || "",
        snapshot_type: meta.snapshot_type || "",
        reward_id: rewardId,
        expires_at: expiresAt,
        created: v.getString("created")
      });
    }

    // Soonest-expiring first; vouchers without an expiry go last.
    result.sort((a, b) => {
      const aT = a.expires_at ? new Date(a.expires_at.replace(" ", "T")).getTime() : Infinity;
      const bT = b.expires_at ? new Date(b.expires_at.replace(" ", "T")).getTime() : Infinity;
      return aT - bT;
    });

    return e.json(200, { success: true, customer_id: customerId, vouchers: result });
  } catch (err) {
    console.log("[NFC CUSTOMER VOUCHERS ERROR]", err.message || err);
    return e.json(200, { success: true, vouchers: [] });
  }
});

