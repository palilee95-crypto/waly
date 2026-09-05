// pb_hooks/cascade_delete_user.pb.js
// Cascade-delete all user-dependent and merchant-dependent data when a user is deleted.

// 1. Hook on direct PocketBase user record deletion
onRecordDelete((e) => {
  const userId = e.record.id;
  if (!userId) return e.next();

  const safeDelete = (collection, filter) => {
    try {
      const records = $app.findRecordsByFilter(collection, filter, "-created", 2000, 0);
      if (records && records.length > 0) {
        for (let i = 0; i < records.length; i++) {
          try { $app.delete(records[i]); } catch (delErr) {}
        }
      }
    } catch (err) {}
  };

  let merchantIds = [];
  try {
    const merchants = $app.findRecordsByFilter("merchants", `owner = '${userId}'`, "-created", 50, 0);
    for (let i = 0; i < merchants.length; i++) {
      merchantIds.push(merchants[i].id);
    }
  } catch (err) {}

  for (let m = 0; m < merchantIds.length; m++) {
    const mid = merchantIds[m];

    // Step A: Find rewards and delete all vouchers referencing those rewards (even from other customers)
    try {
      const rewards = $app.findRecordsByFilter("rewards", `merchant = '${mid}'`, "-created", 500, 0);
      for (let r = 0; r < rewards.length; r++) {
        safeDelete("vouchers", `reward = '${rewards[r].id}'`);
      }
    } catch (rErr) {}

    // Step B: Find loyalty programs and delete all loyalty cards & transactions referencing them
    try {
      const progs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${mid}'`, "-created", 500, 0);
      for (let p = 0; p < progs.length; p++) {
        safeDelete("loyalty_cards", `program = '${progs[p].id}'`);
      }
    } catch (pErr) {}

    // Step C: Delete transactions and loyalty cards belonging to merchant
    safeDelete("transactions", `merchant = '${mid}'`);
    safeDelete("loyalty_cards", `merchant = '${mid}'`);
    safeDelete("loyalty_programs", `merchant = '${mid}'`);
    safeDelete("rewards", `merchant = '${mid}'`);

    // Step D: Follow-up groups, sequences, messages, members, logs
    try {
      const groups = $app.findRecordsByFilter("follow_up_groups", `merchant = '${mid}'`, "-created", 200, 0);
      for (let g = 0; g < groups.length; g++) {
        const gid = groups[g].id;
        safeDelete("follow_up_logs", `group = '${gid}'`);
        safeDelete("follow_up_members", `group = '${gid}'`);
        try {
          const sequences = $app.findRecordsByFilter("follow_up_sequences", `group = '${gid}'`, "-created", 200, 0);
          for (let s = 0; s < sequences.length; s++) {
            safeDelete("follow_up_messages", `sequence = '${sequences[s].id}'`);
            safeDelete("follow_up_logs", `sequence = '${sequences[s].id}'`);
            try { $app.delete(sequences[s]); } catch (e) {}
          }
        } catch (e2) {}
        try { $app.delete(groups[g]); } catch (e3) {}
      }
    } catch (e4) {}

    // Step E: Branches, store locations and activation codes
    try {
      const branches = $app.findRecordsByFilter("branches", `merchant = '${mid}'`, "-created", 200, 0);
      for (let b = 0; b < branches.length; b++) {
        safeDelete("activation_codes", `branch = '${branches[b].id}'`);
      }
    } catch (bErr) {}

    safeDelete("activation_codes", `redeemed_by = '${mid}'`);
    safeDelete("store_locations", `merchant = '${mid}'`);
    safeDelete("branches", `merchant = '${mid}'`);
    safeDelete("campaigns", `merchant = '${mid}'`);
    safeDelete("broadcasts", `merchant = '${mid}'`);
    safeDelete("subscriptions", `merchant = '${mid}'`);
    safeDelete("whatsapp_configurations", `merchant = '${mid}'`);
    safeDelete("nfc_claims", `merchant = '${mid}'`);
    safeDelete("hardware_orders", `merchant = '${mid}'`);
    safeDelete("store_feedbacks", `merchant = '${mid}'`);
    safeDelete("automation_rules", `merchant = '${mid}'`);
    safeDelete("birthday_logs", `merchant = '${mid}'`);
    safeDelete("birthday_rewards", `merchant = '${mid}'`);
    safeDelete("commissions", `referred_merchant = '${mid}'`);
    safeDelete("sales_agent_referrals", `merchant = '${mid}'`);
    safeDelete("prospects", `merchant = '${mid}'`);

    // Step F: Unlink staff members
    try {
      const staff = $app.findRecordsByFilter("users", `merchant_id = '${mid}'`, "-created", 500, 0);
      for (let st = 0; st < staff.length; st++) {
        if (staff[st].id !== userId) {
          try {
            staff[st].set("merchant_id", "");
            staff[st].set("branch_name", "");
            staff[st].set("branch", "");
            $app.save(staff[st]);
          } catch (stErr) {}
        }
      }
    } catch (stFindErr) {}

    // Step G: Delete merchant record
    try {
      const mRec = $app.findRecordById("merchants", mid);
      if (mRec) $app.delete(mRec);
    } catch (delMerchErr) {
      console.log(`[CASCADE] Failed to delete merchant ${mid}: ${delMerchErr.message || delMerchErr}`);
    }
  }

  // Step H: Delete customer-level data
  safeDelete("vouchers", `customer = '${userId}'`);
  safeDelete("loyalty_cards", `customer = '${userId}'`);
  safeDelete("transactions", `customer = '${userId}'`);
  safeDelete("nfc_claims", `customer = '${userId}'`);
  safeDelete("fraud_flags", `user = '${userId}'`);
  safeDelete("follow_up_members", `customer = '${userId}'`);
  safeDelete("follow_up_logs", `customer = '${userId}'`);
  safeDelete("birthday_logs", `customer = '${userId}'`);
  safeDelete("store_feedbacks", `customer = '${userId}'`);
  safeDelete("qr_transactions", `customer = '${userId}'`);
  safeDelete("redemptions", `customer = '${userId}'`);
  safeDelete("prospects", `customer = '${userId}' || agent = '${userId}'`);
  safeDelete("commissions", `agent = '${userId}'`);
  safeDelete("sales_agent_referrals", `agent = '${userId}'`);
  safeDelete("hardware_orders", `user = '${userId}'`);
  safeDelete("notifications", `user = '${userId}'`);

  return e.next();
}, "users");

// 2. Custom REST Route for Admin Portal
routerAdd("POST", "/api/risev/admin/users/delete", (c) => {
  let authRecord = c.auth || null;
  if (!authRecord && typeof c.get === "function") {
    try { authRecord = c.get("authRecord"); } catch (e) {}
  }
  if (!authRecord && c.httpContext) {
    try { authRecord = c.httpContext.get("authRecord"); } catch (e) {}
  }

  // Fallback: Token lookup
  if (!authRecord) {
    let authHeader = "";
    try {
      if (c.requestInfo && c.requestInfo().headers) {
        authHeader = c.requestInfo().headers["authorization"] || "";
      }
    } catch (e) {}

    if (!authHeader) {
      try { authHeader = c.request().header.get("Authorization") || ""; } catch (e) {}
    }

    if (authHeader) {
      const parts = authHeader.split(" ");
      const token = parts.length === 2 ? parts[1] : parts[0];
      if (token) {
        try {
          authRecord = $app.findAuthRecordByToken(token, $app.settings().recordAuthToken.secret);
        } catch (tokErr) {
          try { authRecord = $app.findAuthRecordByToken(token); } catch (tokErr2) {}
        }
      }
    }
  }

  if (!authRecord) {
    return c.json(401, { success: false, message: "Authentication required." });
  }

  let body = {};
  try {
    body = c.requestInfo().body || {};
  } catch (e) {
    try { body = $apis.requestInfo(c).data || {}; } catch (e2) { body = {}; }
  }

  const targetUserId = (body.userId || body.id || "").trim();
  if (!targetUserId) {
    return c.json(400, { success: false, message: "User ID is required." });
  }

  try {
    const userRec = $app.findRecordById("users", targetUserId);
    if (!userRec) {
      return c.json(404, { success: false, message: "User not found." });
    }

    const userName = userRec.getString("name") || "User";

    // Inlined safeDelete helper
    const safeDelete = (collection, filter) => {
      try {
        const records = $app.findRecordsByFilter(collection, filter, "-created", 2000, 0);
        if (records && records.length > 0) {
          for (let i = 0; i < records.length; i++) {
            try { $app.delete(records[i]); } catch (delErr) {}
          }
        }
      } catch (err) {}
    };

    // 1. Find and delete merchants owned by user + their dependents
    let merchantIds = [];
    try {
      const merchants = $app.findRecordsByFilter("merchants", `owner = '${targetUserId}'`, "-created", 50, 0);
      for (let i = 0; i < merchants.length; i++) {
        merchantIds.push(merchants[i].id);
      }
    } catch (err) {}

    for (let m = 0; m < merchantIds.length; m++) {
      const mid = merchantIds[m];

      // Step A: Delete vouchers referencing rewards of this merchant
      try {
        const rewards = $app.findRecordsByFilter("rewards", `merchant = '${mid}'`, "-created", 500, 0);
        for (let r = 0; r < rewards.length; r++) {
          safeDelete("vouchers", `reward = '${rewards[r].id}'`);
        }
      } catch (rErr) {}

      // Step B: Delete loyalty cards referencing programs of this merchant
      try {
        const progs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${mid}'`, "-created", 500, 0);
        for (let p = 0; p < progs.length; p++) {
          safeDelete("loyalty_cards", `program = '${progs[p].id}'`);
        }
      } catch (pErr) {}

      // Step C: Delete transactions and loyalty cards
      safeDelete("transactions", `merchant = '${mid}'`);
      safeDelete("loyalty_cards", `merchant = '${mid}'`);
      safeDelete("loyalty_programs", `merchant = '${mid}'`);
      safeDelete("rewards", `merchant = '${mid}'`);

      // Step D: Follow-up groups, sequences, messages, members, logs
      try {
        const groups = $app.findRecordsByFilter("follow_up_groups", `merchant = '${mid}'`, "-created", 200, 0);
        for (let g = 0; g < groups.length; g++) {
          const gid = groups[g].id;
          safeDelete("follow_up_logs", `group = '${gid}'`);
          safeDelete("follow_up_members", `group = '${gid}'`);
          try {
            const sequences = $app.findRecordsByFilter("follow_up_sequences", `group = '${gid}'`, "-created", 200, 0);
            for (let s = 0; s < sequences.length; s++) {
              safeDelete("follow_up_messages", `sequence = '${sequences[s].id}'`);
              safeDelete("follow_up_logs", `sequence = '${sequences[s].id}'`);
              try { $app.delete(sequences[s]); } catch (e) {}
            }
          } catch (e2) {}
          try { $app.delete(groups[g]); } catch (e3) {}
        }
      } catch (e4) {}

      // Step E: Branches, store locations and activation codes
      try {
        const branches = $app.findRecordsByFilter("branches", `merchant = '${mid}'`, "-created", 200, 0);
        for (let b = 0; b < branches.length; b++) {
          safeDelete("activation_codes", `branch = '${branches[b].id}'`);
        }
      } catch (bErr) {}

      safeDelete("activation_codes", `redeemed_by = '${mid}'`);
      safeDelete("store_locations", `merchant = '${mid}'`);
      safeDelete("branches", `merchant = '${mid}'`);
      safeDelete("campaigns", `merchant = '${mid}'`);
      safeDelete("broadcasts", `merchant = '${mid}'`);
      safeDelete("subscriptions", `merchant = '${mid}'`);
      safeDelete("whatsapp_configurations", `merchant = '${mid}'`);
      safeDelete("nfc_claims", `merchant = '${mid}'`);
      safeDelete("hardware_orders", `merchant = '${mid}'`);
      safeDelete("store_feedbacks", `merchant = '${mid}'`);
      safeDelete("automation_rules", `merchant = '${mid}'`);
      safeDelete("birthday_logs", `merchant = '${mid}'`);
      safeDelete("birthday_rewards", `merchant = '${mid}'`);
      safeDelete("commissions", `referred_merchant = '${mid}'`);
      safeDelete("sales_agent_referrals", `merchant = '${mid}'`);
      safeDelete("prospects", `merchant = '${mid}'`);

      // Step F: Unlink staff members
      try {
        const staff = $app.findRecordsByFilter("users", `merchant_id = '${mid}'`, "-created", 500, 0);
        for (let st = 0; st < staff.length; st++) {
          if (staff[st].id !== targetUserId) {
            try {
              staff[st].set("merchant_id", "");
              staff[st].set("branch_name", "");
              staff[st].set("branch", "");
              $app.save(staff[st]);
            } catch (stErr) {}
          }
        }
      } catch (stFindErr) {}

      // Step G: Delete merchant record
      try {
        const mRec = $app.findRecordById("merchants", mid);
        if (mRec) $app.delete(mRec);
      } catch (delMerchErr) {
        console.log(`[CASCADE] Failed to delete merchant ${mid}: ${delMerchErr.message || delMerchErr}`);
      }
    }

    // 2. Delete user-level customer records
    safeDelete("vouchers", `customer = '${targetUserId}'`);
    safeDelete("loyalty_cards", `customer = '${targetUserId}'`);
    safeDelete("transactions", `customer = '${targetUserId}'`);
    safeDelete("nfc_claims", `customer = '${targetUserId}'`);
    safeDelete("fraud_flags", `user = '${targetUserId}'`);
    safeDelete("follow_up_members", `customer = '${targetUserId}'`);
    safeDelete("follow_up_logs", `customer = '${targetUserId}'`);
    safeDelete("birthday_logs", `customer = '${targetUserId}'`);
    safeDelete("store_feedbacks", `customer = '${targetUserId}'`);
    safeDelete("qr_transactions", `customer = '${targetUserId}'`);
    safeDelete("redemptions", `customer = '${targetUserId}'`);
    safeDelete("prospects", `customer = '${targetUserId}' || agent = '${targetUserId}'`);
    safeDelete("commissions", `agent = '${targetUserId}'`);
    safeDelete("sales_agent_referrals", `agent = '${targetUserId}'`);
    safeDelete("hardware_orders", `user = '${targetUserId}'`);
    safeDelete("notifications", `user = '${targetUserId}'`);

    // 3. Finally delete the user record
    $app.delete(userRec);

    console.log(`[ADMIN DELETE USER] Successfully deleted user ${userName} (${targetUserId}) and all cascade data.`);

    return c.json(200, {
      success: true,
      message: `User ${userName} and all associated data have been permanently deleted.`
    });
  } catch (err) {
    console.log(`[ADMIN DELETE USER ERROR]`, err.message || err);
    return c.json(500, {
      success: false,
      message: "Failed to delete user: " + (err.message || err)
    });
  }
});