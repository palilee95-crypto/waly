// pb_hooks/cascade_delete_user.pb.js
// Cascade-delete all user-dependent and merchant-dependent data when a user is deleted.

function cascadeDeleteUserInternal(userId) {
  if (!userId) return;

  // Helper: fetch + delete all records in `collection` matching `filter` safely without infinite loops
  const safeDelete = (collection, filter) => {
    try {
      const records = $app.findRecordsByFilter(collection, filter, "-created", 1000, 0);
      if (records && records.length > 0) {
        for (let i = 0; i < records.length; i++) {
          try {
            $app.delete(records[i]);
          } catch (delErr) {
            console.log(`[CASCADE] Failed to delete ${collection} record ${records[i].id}: ${delErr.message || delErr}`);
          }
        }
      }
    } catch (err) {
      // Ignore if collection does not exist or filter is invalid
    }
  };

  // ---- Step 1: Find merchant(s) owned by this user ----
  let merchantIds = [];
  try {
    const merchants = $app.findRecordsByFilter("merchants", `owner = '${userId}'`, "-created", 50, 0);
    for (let i = 0; i < merchants.length; i++) {
      merchantIds.push(merchants[i].id);
    }
  } catch (err) {
    console.log(`[CASCADE] Error finding merchants for user ${userId}: ${err.message || err}`);
  }

  // ---- Step 2: Delete records referencing the merchant(s) ----
  for (let m = 0; m < merchantIds.length; m++) {
    const mid = merchantIds[m];

    // Follow up sequences & messages
    try {
      const groups = $app.findRecordsByFilter("follow_up_groups", `merchant = '${mid}'`, "-created", 200, 0);
      for (let g = 0; g < groups.length; g++) {
        const gid = groups[g].id;
        safeDelete("follow_up_members", `group = '${gid}'`);
        
        try {
          const sequences = $app.findRecordsByFilter("follow_up_sequences", `group = '${gid}'`, "-created", 200, 0);
          for (let s = 0; s < sequences.length; s++) {
            safeDelete("follow_up_messages", `sequence = '${sequences[s].id}'`);
            try { $app.delete(sequences[s]); } catch (e) {}
          }
        } catch (e2) {}

        try { $app.delete(groups[g]); } catch (e3) {}
      }
    } catch (e4) {}

    // Merchant dependent collections
    safeDelete("branches", `merchant = '${mid}'`);
    safeDelete("campaigns", `merchant = '${mid}'`);
    safeDelete("loyalty_programs", `merchant = '${mid}'`);
    safeDelete("loyalty_cards", `merchant = '${mid}'`);
    safeDelete("rewards", `merchant = '${mid}'`);
    safeDelete("transactions", `merchant = '${mid}'`);
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
    safeDelete("activation_codes", `redeemed_by = '${mid}'`);

    // Unlink any staff linked to this merchant
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

    // Delete the merchant record
    try {
      const mRec = $app.findRecordById("merchants", mid);
      if (mRec) $app.delete(mRec);
    } catch (delMerchErr) {
      console.log(`[CASCADE] Failed to delete merchant ${mid}: ${delMerchErr.message || delMerchErr}`);
    }
  }

  // ---- Step 3: Delete user-dependent records (customer relations) ----
  safeDelete("loyalty_cards", `customer = '${userId}'`);
  safeDelete("transactions", `customer = '${userId}'`);
  safeDelete("vouchers", `customer = '${userId}'`);
  safeDelete("nfc_claims", `customer = '${userId}'`);
  safeDelete("fraud_flags", `user = '${userId}'`);
  safeDelete("follow_up_members", `customer = '${userId}'`);
  safeDelete("follow_up_logs", `customer = '${userId}'`);
  safeDelete("birthday_logs", `customer = '${userId}'`);
  safeDelete("store_feedbacks", `customer = '${userId}'`);
  safeDelete("qr_transactions", `customer = '${userId}'`);
  safeDelete("redemptions", `customer = '${userId}'`);
  safeDelete("prospects", `customer = '${userId}' || agent = '${userId}'`);
  safeDelete("notifications", `user = '${userId}'`);
}

// 1. Hook on direct PocketBase user record deletion
onRecordDelete((e) => {
  cascadeDeleteUserInternal(e.record.id);
  return e.next();
}, "users");

// 2. Custom REST Route for Admin Portal (allows sales agents / superusers to delete users cleanly)
routerAdd("POST", "/api/risev/admin/users/delete", (c) => {
  let authRecord = c.auth || null;
  if (!authRecord && typeof c.get === "function") {
    try { authRecord = c.get("authRecord"); } catch (e) {}
  }
  if (!authRecord && c.httpContext) {
    try { authRecord = c.httpContext.get("authRecord"); } catch (e) {}
  }

  // Fallback: If token was passed in Authorization header, resolve user directly
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

    // Run cascade delete
    cascadeDeleteUserInternal(targetUserId);

    // Delete user record
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