// pb_hooks/manual_give.pb.js
// Endpoint for merchant to manually issue stamps to a customer by phone number

routerAdd("GET", "/api/risev/merchant/give-customer", (e) => {
  if (!e.auth) return e.json(401, { message: "Sign in to look up a customer." });

  let merchantId = e.auth.getString("merchant_id");
  if (!merchantId) {
    const merchants = $app.findRecordsByFilter("merchants", `owner = '${e.auth.id}'`, "created", 1, 0);
    if (merchants.length) merchantId = merchants[0].id;
  }
  if (!merchantId) return e.json(403, { message: "No merchant profile is linked to this account." });

  const query = (e.requestInfo() && e.requestInfo().query) || {};
  let digits = String(query.phone || "").replace(/[^\d]/g, "");
  if (digits.startsWith("0")) digits = "6" + digits;
  if (!digits.startsWith("60")) digits = "60" + digits;
  const subscriber = digits.slice(2);
  if (!/^1\d{8,9}$/.test(subscriber) || (subscriber.startsWith("11") && subscriber.length !== 10)) {
    return e.json(400, { message: "Enter a complete Malaysian mobile number." });
  }

  const local = "0" + subscriber;
  try {
    const users = $app.findRecordsByFilter(
      "users",
      `phone = '+${digits}' || phone = '${digits}' || phone = '${local}'`,
      "-created", 1, 0
    );
    if (!users.length) return e.json(200, { found: false, requiresName: true });

    const customer = users[0];
    const name = customer.getString("name").trim();
    const requiresName = !name || /^Customer(?:[ _]|$)/i.test(name);
    let stamps = 0;
    let points = 0;
    try {
      let programs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${merchantId}' && is_active = true`, "-created", 1, 0);
      if (!programs.length) programs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${merchantId}'`, "-created", 1, 0);
      if (programs.length) {
        const cards = $app.findRecordsByFilter(
          "loyalty_cards",
          `customer = '${customer.id}' && merchant = '${merchantId}' && program = '${programs[0].id}'`,
          "-created", 1, 0
        );
        if (cards.length) {
          stamps = Number(cards[0].get("stamps_collected")) || 0;
          points = Number(cards[0].get("points_balance")) || 0;
        }
      }
    } catch (cardErr) {
      console.log("[GIVE CUSTOMER LOOKUP] Could not load loyalty balance:", cardErr.message || cardErr);
    }
    return e.json(200, {
      found: true,
      requiresName,
      customer: { id: customer.id, name: requiresName ? "" : name, stamps, points }
    });
  } catch (err) {
    console.log("[GIVE CUSTOMER LOOKUP] Failed:", err.message || err);
    return e.json(500, { message: "Could not check this number. Try again." });
  }
});

routerAdd("POST", "/api/risev/merchant/give-manual", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized merchant authentication required" });
    }

    const body = e.requestInfo().body || {};
    const rawPhone = (body.phone || "").trim();
    const billAmount = parseFloat(body.bill_amount) || 0;
    const stampAmount = parseInt(body.stamp_amount) || 1;
    const customerNameInput = (body.customer_name || "").trim();

    if (!rawPhone) {
      return e.json(400, { message: "Customer phone number is required" });
    }

    // Format phone (+60)
    let digits = rawPhone.replace(/[^\d]/g, '');
    if (digits.startsWith('0')) digits = '6' + digits;
    if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
    const subscriber = digits.startsWith('60') ? digits.slice(2) : digits;
    if (!/^1\d{8,9}$/.test(subscriber) || (subscriber.startsWith('11') && subscriber.length !== 10)) {
      return e.json(400, { message: "Enter a complete Malaysian mobile number." });
    }
    const cleanPhone = '+' + digits;

    // Get merchant ID linked to current authenticated user
    let merchantId = authRecord.getString("merchant_id");
    if (!merchantId) {
      const merchants = $app.findRecordsByFilter("merchants", `owner = '${authRecord.id}'`, "created", 1, 0);
      if (merchants.length > 0) merchantId = merchants[0].id;
    }

    if (!merchantId) {
      return e.json(400, { message: "No merchant profile associated with logged in account" });
    }

    // 1. Find or auto-create customer user by phone
    let customer = null;
    if (digits) {
      const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
      const phoneFilter = `phone = '${cleanPhone}' || phone = '${digits}' || phone = '${localDigits}'`;
      try {
        const users = $app.findRecordsByFilter("users", phoneFilter, "-created", 1, 0);
        if (users.length > 0) customer = users[0];
      } catch (err) {
        console.log("[MANUAL GIVE] Customer lookup failed:", err.message || err);
        return e.json(500, { message: "Could not check this number. Try again." });
      }
    }

    if (!customer) {
      if (!customerNameInput) {
        return e.json(400, { message: "Enter a customer name for a new phone number." });
      }
      const userCol = $app.findCollectionByNameOrId("users");
      customer = new Record(userCol);
      customer.set("id", $security.randomString(15).toLowerCase());
      customer.set("phone", cleanPhone);
      customer.set("email", `shadow_cust_${digits}@risev.app`);
      customer.set("name", customerNameInput);
      customer.set("role", "customer");
      customer.set("birthday", "2000-01-01 00:00:00.000Z");
      customer.setPassword($security.randomString(20));
      $app.save(customer);
    } else {
      // Existing placeholder records also need a real name before issuing rewards.
      const currentName = customer.getString("name");
      const needsName = !currentName || /^Customer(?:[ _]|$)/i.test(currentName);
      if (needsName && !customerNameInput) {
        return e.json(400, { message: "Enter this customer's name before issuing rewards." });
      }
      if (needsName && customerNameInput) {
        customer.set("name", customerNameInput);
        $app.save(customer);
      }
    }

    // 2. Find or auto-create merchant's loyalty program
    let programs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${merchantId}' && is_active = true`, "-created", 1, 0);
    if (!programs.length) programs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${merchantId}'`, "-created", 1, 0);
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

    const programId = program.id;
    const goal = parseInt(program.get("stamp_goal")) || 10;
    const isStampsEnabled = program.get("enable_stamps") !== false;
    const isPointsEnabled = program.get("enable_points") !== false;
    const actualStampsToAward = isStampsEnabled ? stampAmount : 0;

    const minSpend = parseFloat(program.get("min_spend_amount")) || 0;
    if (actualStampsToAward > 0 && minSpend > 0 && billAmount < minSpend) {
      return e.json(400, {
        message: "Bill amount (RM " + billAmount.toFixed(2) + ") is below minimum spend requirement (RM " + minSpend.toFixed(2) + ") to receive stamps."
      });
    }

    // 3. Find or create loyalty card & add stamps
    let card = null;
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
    const totalStamps = isStampsEnabled ? (currentStamps + actualStampsToAward) : currentStamps;
    if (isStampsEnabled) {
      card.set("stamps_collected", totalStamps);
    }
    card.set("last_activity", new Date().toISOString().replace('T', ' ').substring(0, 19));
    $app.save(card);

    // 4. Record transaction
    const branchId = (body.branch_id || authRecord.getString("branch") || "").trim();

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
    txn.set("stamps", actualStampsToAward);
    txn.set("bill_amount", billAmount);
    txn.set("customer", customer.id);
    txn.set("merchant", merchantId);
    txn.set("loyalty_card", card.id);
    txn.set("staff", authRecord.id);
    const verifiedBranchId = resolveBranchId(merchantId, branchId);
    let branchName = (body.branch_name || authRecord.getString("branch_name") || "Main Counter").trim();
    if (verifiedBranchId) {
      try { branchName = $app.findRecordById("branches", verifiedBranchId).getString("name") || branchName; } catch (branchErr) {}
    }
    txn.set("branch", verifiedBranchId);
    
    const txnMeta = {
      source: "manual_give",
      staff_id: authRecord.id,
      staff_name: authRecord.getString("name") || "Merchant",
      branch_name: branchName,
      branch_id: verifiedBranchId
    };
    txn.set("metadata", JSON.stringify(txnMeta));
    $app.save(txn);

    // 6. Transaction completed - welcome_notification.pb.js handles sending the WhatsApp receipt
    const resolvedCustomerName = customer.getString("name") || customerNameInput || ("Customer " + digits.slice(-4));
    console.log(`[MANUAL GIVE] Processed transaction for ${resolvedCustomerName} (${cleanPhone}), stamps: ${actualStampsToAward}, bill: RM${billAmount}`);

    let nextRewardName = "";
    try {
      const rewardId = program.getString("linked_reward");
      if (rewardId) {
        const rew = $app.findRecordById("rewards", rewardId);
        if (rew) nextRewardName = rew.getString("name");
      }
    } catch (rErr) {}

    let merchantStoreName = "Risev Store";
    try {
      const merchRec = $app.findRecordById("merchants", merchantId);
      if (merchRec) merchantStoreName = merchRec.getString("name");
    } catch (mErr) {}

    // Snapshot this manual entry as a recorded receipt. The cashier has not
    // confirmed a payment here, so it must never be labelled PAID like POS.
    // A receipt failure must not invite a retry that would issue stamps twice.
    let receiptId = "";
    try {
      const receipt = new Record($app.findCollectionByNameOrId("digital_receipts"));
      receipt.set("merchant", merchantId);
      receipt.set("transaction", txn.id);
      receipt.set("customer", customer.id);
      receipt.set("customer_phone", cleanPhone);
      receipt.set("customer_name", resolvedCustomerName);
      receipt.set("staff_name", authRecord.getString("name") || "Merchant");
      receipt.set("branch_name", branchName);
      receipt.set("receipt_number", "RV-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + txn.id.slice(-6).toUpperCase());
      receipt.set("line_items", [{ name: billAmount > 0 ? "Manual sale entry" : "Loyalty stamp issue", qty: 1, price: billAmount }]);
      receipt.set("subtotal", billAmount);
      receipt.set("discount_amount", 0);
      receipt.set("total_amount", billAmount);
      receipt.set("payment_method", "Manual entry");
      receipt.set("payment_status", "recorded");
      receipt.set("stamps_earned", actualStampsToAward);
      receipt.set("stamps_before", currentStamps);
      receipt.set("stamps_balance", totalStamps);
      receipt.set("stamp_goal", goal);
      receipt.set("reward_name", nextRewardName || program.getString("reward_name") || "");
      $app.save(receipt);
      receiptId = receipt.id;
    } catch (receiptErr) {
      console.log("[MANUAL GIVE] Transaction saved but receipt unavailable:", receiptErr.message || receiptErr);
    }

    let pointsBalance = 0;
    try { pointsBalance = Number($app.findRecordById("loyalty_cards", card.id).get("points_balance")) || 0; } catch (pointsErr) {}

    const successMessage = isStampsEnabled
      ? `${actualStampsToAward} stamp(s) issued to ${resolvedCustomerName}`
      : `Points awarded to ${resolvedCustomerName}`;

    return e.json(200, {
      success: true,
      message: successMessage,
      customerName: resolvedCustomerName,
      phone: cleanPhone,
      totalStamps: totalStamps,
      goal: goal,
      transactionId: txn.id,
      receiptId: receiptId,
      billAmount: billAmount,
      stampsEarned: actualStampsToAward,
      // Points written by points_multiplier.pb.js during the create. The receipt used
      // to guess floor(bill), which ignored spend_per_point, campaigns and streaks.
      pointsEarned: txn.getInt("points") || 0,
      pointsBalance: pointsBalance,
      storeName: merchantStoreName,
      branchName: branchName,
      nextRewardName: nextRewardName,
      created: txn.getString("created") || new Date().toISOString()
    });
  } catch (err) {
    return e.json(500, { message: "Failed to manually issue stamps: " + (err.message || err) });
  }
});

// Auto-ensure min_spend_amount field exists on loyalty_programs upon bootstrap
onBootstrap((e) => {
  e.next();
  try {
    const col = $app.findCollectionByNameOrId("loyalty_programs");
    if (col) {
      let hasField = false;
      try {
        hasField = !!col.fields.getByName("min_spend_amount");
      } catch (fErr) {}
      if (!hasField) {
        col.fields.add(new Field({
          "id": "num_min_spend_lp",
          "name": "min_spend_amount",
          "type": "number",
          "min": 0,
          "required": false
        }));
        $app.save(col);
        console.log("[BOOTSTRAP] Added min_spend_amount field to loyalty_programs");
      }
    }
  } catch (bErr) {
    console.log("[BOOTSTRAP LP NOTE]", bErr.message || bErr);
  }
});

