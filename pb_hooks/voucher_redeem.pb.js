// pb_hooks/voucher_redeem.pb.js

// 1. Dedicated Merchant / Staff Voucher Redemption Endpoint
routerAdd("POST", "/api/risev/merchant/vouchers/redeem", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { success: false, message: "Unauthorized. Merchant login required." });
    }

    const authRole = authRecord.getString("role");
    if (authRole !== "merchant" && authRole !== "both") {
      return e.json(403, { success: false, message: "Forbidden. Merchant or staff access required." });
    }

    // Resolve active merchant ID
    let merchantId = authRecord.getString("merchant_id");
    if (!merchantId) {
      try {
        const owned = $app.findRecordsByFilter("merchants", `owner = "${authRecord.id}"`, "-created", 1, 0);
        if (owned.length > 0) merchantId = owned[0].id;
      } catch (err) {}
    }

    if (!merchantId) {
      return e.json(400, { success: false, message: "Account is not associated with any merchant store." });
    }

    const body = e.requestInfo().body || {};
    let rawCode = (body.code || "").trim();
    if (!rawCode) {
      return e.json(400, { success: false, message: "Voucher code is required." });
    }

    // Clean up code if scanned from URL or formatted text
    if (rawCode.includes("?code=")) {
      rawCode = rawCode.split("?code=")[1].split("&")[0];
    } else if (rawCode.includes("/")) {
      rawCode = rawCode.substring(rawCode.lastIndexOf("/") + 1);
    }
    const cleanCode = rawCode.trim().toUpperCase();

    // 1. Query voucher record by code
    let vouchers = [];
    try {
      vouchers = $app.findRecordsByFilter("vouchers", `code = "${cleanCode}"`, "-created", 1, 0);
    } catch (qErr) {
      console.log("Error querying voucher code:", qErr.message || qErr);
    }

    if (!vouchers || vouchers.length === 0) {
      return e.json(404, {
        success: false,
        message: `Voucher code "${cleanCode}" not found. Please verify the code.`
      });
    }

    const voucher = vouchers[0];
    const status = voucher.getString("status");

    // 2. Validate voucher status
    if (status === "used") {
      const usedAt = voucher.getString("used_at") || voucher.getString("updated");
      return e.json(400, {
        success: false,
        message: `Voucher "${cleanCode}" has already been redeemed${usedAt ? ' on ' + usedAt.substring(0, 10) : ''}.`
      });
    }

    if (status === "expired" || status === "voided") {
      return e.json(400, {
        success: false,
        message: `Voucher "${cleanCode}" is ${status} and cannot be redeemed.`
      });
    }

    // 3. Validate expiration date
    const expiresAt = voucher.getString("expires_at");
    if (expiresAt) {
      const expDate = new Date(expiresAt.replace(' ', 'T'));
      if (!isNaN(expDate.getTime()) && expDate < new Date()) {
        try {
          voucher.set("status", "expired");
          $app.save(voucher);
        } catch (sErr) {}
        return e.json(400, {
          success: false,
          message: `Voucher "${cleanCode}" expired on ${expiresAt.substring(0, 10)}.`
        });
      }
    }

    // 4. Validate merchant ownership (loyalty reward or marketing campaign)
    const rewardId = voucher.getString("reward");
    const campaignId = voucher.getString("campaign");
    let voucherMerchantId = voucher.getString("merchant");
    let rewardTitle = "";
    let rewardPointsCost = 0;
    let campaignTitle = "";
    let discountType = "";
    let discountValue = "";

    // Parse metadata if available
    try {
      const rawMeta = voucher.get("metadata");
      const parsedMeta = typeof rawMeta === "string" ? JSON.parse(rawMeta) : (rawMeta || {});
      if (!voucherMerchantId && parsedMeta.merchant_id) {
        voucherMerchantId = parsedMeta.merchant_id;
      }
      discountType = parsedMeta.discount_type || "";
      discountValue = parsedMeta.discount_value || "";
    } catch (mErr) {}

    // Check reward
    if (rewardId) {
      try {
        const reward = $app.findRecordById("rewards", rewardId);
        if (reward) {
          if (!voucherMerchantId) voucherMerchantId = reward.getString("merchant");
          rewardTitle = reward.getString("title") || reward.getString("name") || "";
          rewardPointsCost = reward.getInt("points_cost") || 0;
        }
      } catch (rErr) {}
    }

    // Check campaign
    if (campaignId) {
      try {
        const campaign = $app.findRecordById("campaigns", campaignId);
        if (campaign) {
          if (!voucherMerchantId) voucherMerchantId = campaign.getString("merchant");
          campaignTitle = campaign.getString("name") || campaign.getString("title") || "";
          if (!discountType) discountType = campaign.getString("discount_type") || "";
          if (!discountValue) discountValue = campaign.getString("discount_value") || "";
        }
      } catch (cErr) {}
    }

    if (voucherMerchantId && voucherMerchantId !== merchantId) {
      return e.json(403, {
        success: false,
        message: "This voucher belongs to another merchant store and cannot be redeemed here."
      });
    }

    // 5. Update voucher to used status
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
    voucher.set("status", "used");
    voucher.set("used_at", nowIso);
    $app.save(voucher);

    // 6. Record redemption transaction in ledger
    const customerId = voucher.getString("customer");
    let customerName = "Customer";
    let customerPhone = "";

    if (customerId) {
      try {
        const customer = $app.findRecordById("users", customerId);
        if (customer) {
          customerName = customer.getString("name") || "Customer";
          customerPhone = customer.getString("phone") || "";
        }
      } catch (uErr) {}
    }

    try {
      const txCol = $app.findCollectionByNameOrId("transactions");
      const tx = new Record(txCol);
      tx.set("customer", customerId);
      tx.set("merchant", merchantId);
      tx.set("type", "redeem");
      tx.set("stamps", 0);
      tx.set("points", 0);
      tx.set("staff", authRecord.id);

      const staffName = authRecord.getString("name") || "Staff";
      const branchName = authRecord.getString("branch_name") || "All Branches (HQ)";

      const txMeta = {
        voucher_id: voucher.id,
        voucher_code: cleanCode,
        reward_id: rewardId || "",
        campaign_id: campaignId || "",
        reward_title: rewardTitle || campaignTitle || (discountValue ? `${discountValue} OFF` : "Discount Voucher"),
        discount_type: discountType,
        discount_value: discountValue,
        staff_id: authRecord.id,
        staff_name: staffName,
        branch_name: branchName,
      };
      tx.set("metadata", JSON.stringify(txMeta));
      $app.save(tx);
    } catch (tErr) {
      console.log("Error creating transaction ledger for voucher redemption:", tErr.message || tErr);
    }

    const displayTitle = rewardTitle || campaignTitle || (discountValue ? `${discountType === 'percent' ? discountValue + '%' : 'RM ' + discountValue} OFF` : "Reward Voucher");

    return e.json(200, {
      success: true,
      message: `Voucher ${cleanCode} redeemed successfully!`,
      voucher: {
        id: voucher.id,
        code: cleanCode,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        reward_title: displayTitle,
        discount_type: discountType,
        discount_value: discountValue,
        used_at: nowIso,
      }
    });

  } catch (err) {
    console.log("Voucher redemption handler error:", err.message || err);
    return e.json(500, {
      success: false,
      message: err.message || "An unexpected error occurred during voucher redemption."
    });
  }
}, $apis.requireAuth("users"));

// 2. Lifecycle hook fallback for direct updates
onRecordUpdate((e) => {
  const original = e.record.original();
  const prevStatus = original.get('status');
  const newStatus = e.record.get('status');

  // Trigger when voucher status changes to 'used'
  if (prevStatus === 'active' && newStatus === 'used') {
    try {
      const customerId = e.record.get('customer');
      const rewardId = e.record.get('reward');

      // Fetch the reward to find the merchant
      let merchantId = e.record.get('merchant');
      if (!merchantId && rewardId) {
        try {
          const reward = $app.findRecordById('rewards', rewardId);
          merchantId = reward.get('merchant');
        } catch (rErr) {}
      }

      // If updater is an authenticated merchant, verify they own the merchant
      if (e.auth) {
        const authRole = e.auth.getString('role');
        const authMerchantId = e.auth.getString('merchant_id');
        if ((authRole === 'merchant' || authRole === 'both') && authMerchantId && merchantId && authMerchantId !== merchantId) {
          throw new ForbiddenError('You are not authorized to redeem a voucher for this store.');
        }
      }

      // Create transaction ledger record for the redemption
      const txCol = $app.findCollectionByNameOrId('transactions');
      const tx = new Record(txCol);
      tx.set('customer', customerId);
      tx.set('merchant', merchantId);
      tx.set('type', 'redeem');
      tx.set('stamps', 0);
      tx.set('points', 0);
      tx.set('staff', e.auth ? e.auth.id : '');
      
      const meta = {
        voucher_id: e.record.id,
        reward_id: rewardId,
        staff_id: e.auth ? e.auth.id : '',
        staff_name: e.auth ? (e.auth.getString('name') || 'Staff') : '',
        branch_name: e.auth ? (e.auth.getString('branch_name') || 'All Branches (HQ)') : 'All Branches (HQ)',
      };
      tx.set('metadata', JSON.stringify(meta));
      
      $app.save(tx);
    } catch (err) {
      if (err.name === 'ForbiddenError') throw err;
      console.log("Error logging voucher redemption transaction:", err.message || err);
    }
  }

  return e.next();
}, 'vouchers');
