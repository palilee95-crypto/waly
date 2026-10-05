// pb_hooks/customer_management.pb.js
// Endpoints for merchant to manage their customer records (e.g., updating customer name, phone, notes)

routerAdd("POST", "/api/risev/merchant/customer/update", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized. Please log in first." });
    }

    let merchantId = authRecord.getString("merchant_id");
    if (!merchantId) {
      const merchants = $app.findRecordsByFilter("merchants", `owner = '${authRecord.id}'`, "created", 1, 0);
      if (merchants.length > 0) merchantId = merchants[0].id;
    }

    if (!merchantId) {
      return e.json(400, { message: "No merchant profile associated with logged in account." });
    }

    const body = e.requestInfo().body || {};
    const customerId = (body.customer_id || body.id || "").trim();
    const newName = (body.name || "").trim();
    const rawPhone = (body.phone || "").trim();

    if (!customerId) {
      return e.json(400, { message: "Customer ID is required." });
    }

    if (!newName) {
      return e.json(400, { message: "Customer name cannot be empty." });
    }

    // Find customer record
    let customer = null;
    try {
      customer = $app.findRecordById("users", customerId);
    } catch (err) {
      return e.json(404, { message: "Customer record not found." });
    }

    // Update name
    customer.set("name", newName);

    // If phone is provided, format and update phone
    if (rawPhone) {
      let digits = rawPhone.replace(/[^\d]/g, '');
      if (digits.startsWith('0')) digits = '6' + digits;
      if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
      const cleanPhone = '+' + digits;

      const currentPhone = customer.getString("phone");
      if (currentPhone !== cleanPhone) {
        // Check if another user already has this phone number
        const existingUsers = $app.findRecordsByFilter(
          "users",
          `phone = '${cleanPhone}' && id != '${customerId}'`,
          "created",
          1,
          0
        );

        if (existingUsers.length > 0) {
          return e.json(400, { message: "Phone number is already in use by another customer." });
        }

        customer.set("phone", cleanPhone);

        // If it's a shadow user, also update email to match new phone
        const currentEmail = customer.getString("email");
        if (currentEmail && currentEmail.startsWith("shadow_cust_")) {
          customer.set("email", `shadow_cust_${digits}@risev.app`);
        }
      }
    }

    $app.save(customer);

    console.log(`[CUSTOMER MANAGEMENT] Merchant ${merchantId} updated customer ${customerId} -> Name: "${newName}"`);

    return e.json(200, {
      success: true,
      message: "Customer information updated successfully.",
      customer: {
        id: customer.id,
        name: customer.getString("name"),
        phone: customer.getString("phone"),
      }
    });
  } catch (err) {
    console.log("[CUSTOMER MANAGEMENT] Error updating customer:", err.message || err);
    return e.json(500, { message: "Failed to update customer: " + (err.message || err) });
  }
});

// Endpoint for merchant to remove a customer from their store
routerAdd("POST", "/api/risev/merchant/customer/delete", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized. Please log in first." });
    }

    let merchantId = authRecord.getString("merchant_id");
    if (!merchantId) {
      const merchants = $app.findRecordsByFilter("merchants", `owner = '${authRecord.id}'`, "created", 1, 0);
      if (merchants.length > 0) merchantId = merchants[0].id;
    }

    if (!merchantId) {
      return e.json(400, { message: "No merchant profile associated with logged in account." });
    }

    let merchant = null;
    try {
      merchant = $app.findRecordById("merchants", merchantId);
    } catch (mErr) {
      return e.json(404, { message: "Merchant record not found." });
    }

    // Only store owner can remove customers
    if (merchant.getString("owner") !== authRecord.id) {
      return e.json(403, { message: "Forbidden. Only the store owner can remove customers." });
    }

    const body = e.requestInfo().body || {};
    const customerId = (body.customer_id || body.id || "").trim();

    if (!customerId) {
      return e.json(400, { message: "Customer ID is required." });
    }

    // Check merchant's subscription plan
    let activePlan = "stand_bundle";
    try {
      const subs = $app.findRecordsByFilter(
        "subscriptions",
        `merchant = "${merchantId}" && (status = "active" || status = "trialing")`,
        "-created",
        1,
        0
      );
      if (subs.length > 0) {
        activePlan = (subs[0].getString("plan") || "stand_bundle").toLowerCase();
      }
    } catch (sErr) {}

    // Check deletion quota for stand_bundle
    const isStandBundle = (activePlan === "stand_bundle" || activePlan === "none");
    let meta = {};
    try {
      const rawMeta = merchant.get("metadata");
      meta = typeof rawMeta === "string" ? JSON.parse(rawMeta) : (rawMeta || {});
    } catch (mErr) {
      meta = {};
    }

    const deletionsUsed = parseInt(meta.stand_customer_deletions) || 0;

    if (isStandBundle && deletionsUsed >= 10) {
      return e.json(403, {
        code: "DELETION_LIMIT_REACHED",
        message: "You have reached the maximum of 10 customer removals allowed on the NFC Stand package. Please subscribe to Starter (RM47/mo) or PRO (RM97/mo) to remove more members.",
        deletions_used: deletionsUsed,
        max_deletions: 10,
        plan: activePlan
      });
    }

    // 1. Delete customer's loyalty cards for this merchant
    let deletedCards = 0;
    try {
      const cards = $app.findRecordsByFilter(
        "loyalty_cards",
        `merchant = "${merchantId}" && customer = "${customerId}"`,
        "-created",
        50,
        0
      );
      deletedCards = cards.length;
      for (let i = 0; i < cards.length; i++) {
        $app.delete(cards[i]);
      }
    } catch (cErr) {
      console.log("[CUSTOMER DELETE] Error deleting loyalty cards:", cErr.message || cErr);
    }

    // 2. Delete customer's transactions for this merchant
    try {
      const txs = $app.findRecordsByFilter(
        "transactions",
        `merchant = "${merchantId}" && customer = "${customerId}"`,
        "-created",
        500,
        0
      );
      for (let i = 0; i < txs.length; i++) {
        $app.delete(txs[i]);
      }
    } catch (tErr) {
      console.log("[CUSTOMER DELETE] Error deleting transactions:", tErr.message || tErr);
    }

    // 3. Delete customer's vouchers for this merchant
    try {
      const vouchers = $app.findRecordsByFilter(
        "vouchers",
        `customer = "${customerId}" && reward.merchant = "${merchantId}"`,
        "-created",
        100,
        0
      );
      for (let i = 0; i < vouchers.length; i++) {
        $app.delete(vouchers[i]);
      }
    } catch (vErr) {
      console.log("[CUSTOMER DELETE] Error deleting vouchers:", vErr.message || vErr);
    }

    // 4. Update deletion counter if on stand_bundle
    let remainingDeletions = null;
    if (isStandBundle) {
      const newCount = deletionsUsed + 1;
      meta.stand_customer_deletions = newCount;
      merchant.set("metadata", meta);
      $app.save(merchant);
      remainingDeletions = Math.max(0, 10 - newCount);
    }

    console.log(`[CUSTOMER MANAGEMENT] Merchant ${merchantId} removed customer ${customerId}. Plan: ${activePlan}, Deletions used: ${isStandBundle ? meta.stand_customer_deletions : 'unlimited'}`);

    return e.json(200, {
      success: true,
      message: "Customer successfully removed from store.",
      deleted_cards: deletedCards,
      is_stand_bundle: isStandBundle,
      deletions_used: isStandBundle ? meta.stand_customer_deletions : null,
      remaining_deletions: remainingDeletions,
      plan: activePlan
    });
  } catch (err) {
    console.log("[CUSTOMER MANAGEMENT] Error deleting customer:", err.message || err);
    return e.json(500, { message: "Failed to remove customer: " + (err.message || err) });
  }
});
