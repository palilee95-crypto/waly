// pb_hooks/push_notify.js
// Dispatch Web Push notifications to merchants and staff via risev-push service

function getPushServiceUrl() {
  return $os.getenv("PUSH_SERVICE_URL") || "http://push:3000";
}

function dispatchToPushService(subRecords, payload) {
  if (!subRecords || subRecords.length === 0) {
    return { successCount: 0, failedCount: 0, total: 0 };
  }

  const subscriptions = subRecords.map(function(s) {
    return {
      id: s.id,
      endpoint: s.getString("endpoint"),
      p256dh: s.getString("p256dh"),
      auth: s.getString("auth")
    };
  });

  const requestBody = JSON.stringify({
    subscriptions: subscriptions,
    payload: payload
  });

  let pushUrl = getPushServiceUrl();
  let res = null;

  try {
    res = $http.send({
      url: pushUrl + "/send-batch",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      timeout: 10
    });
  } catch (netErr) {
    // Try localhost fallback for local dev
    try {
      res = $http.send({
        url: "http://localhost:3000/send-batch",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        timeout: 10
      });
    } catch (e2) {
      console.log("[PUSH DISPATCH ERROR] Failed to connect to push service:", netErr.message || netErr);
      return { successCount: 0, failedCount: subRecords.length, error: netErr.message };
    }
  }

  if (res && res.statusCode === 200) {
    try {
      const data = JSON.parse(res.raw);
      // Auto-prune expired subscriptions reported by Apple / Google push services
      if (Array.isArray(data.expiredIds) && data.expiredIds.length > 0) {
        data.expiredIds.forEach(function(expId) {
          try {
            const staleRec = $app.findRecordById("push_subscriptions", expId);
            if (staleRec) {
              $app.delete(staleRec);
              console.log("[PUSH PRUNE] Deleted expired push subscription: " + expId);
            }
          } catch (delErr) {}
        });
      }
      return data;
    } catch (parseErr) {
      console.log("[PUSH DISPATCH ERROR] Failed to parse push service response:", parseErr);
    }
  }

  return { successCount: 0, failedCount: subRecords.length };
}

function sendPushToUser(userId, payload) {
  if (!userId) return null;
  try {
    const subs = $app.findRecordsByFilter(
      "push_subscriptions",
      `user = "${userId}"`,
      "-created",
      20,
      0
    );
    return dispatchToPushService(subs, payload);
  } catch (err) {
    console.log("[PUSH TO USER ERROR]", err.message || err);
    return null;
  }
}

// In-memory debounce cache to prevent spam notifications for the same claim/event
var pushHistory = {};
var PUSH_DEDUPE_WINDOW_MS = 30000; // 30 seconds cooldown per tag

function isDuplicatePush(tag) {
  if (!tag) return false;
  var now = Date.now();
  var lastSent = pushHistory[tag];
  if (lastSent && (now - lastSent) < PUSH_DEDUPE_WINDOW_MS) {
    return true;
  }
  pushHistory[tag] = now;

  // Cleanup old keys periodically
  var keys = Object.keys(pushHistory);
  if (keys.length > 500) {
    keys.forEach(function(k) {
      if (now - pushHistory[k] > PUSH_DEDUPE_WINDOW_MS * 2) {
        delete pushHistory[k];
      }
    });
  }
  return false;
}

function sendPushToMerchant(merchantId, branchId, payload) {
  if (!merchantId) return null;

  // Anti-spam check: suppress duplicate pushes within cooldown window
  if (payload && payload.tag && isDuplicatePush(payload.tag)) {
    console.log("[PUSH DEBOUNCE] Suppressed duplicate push for tag: " + payload.tag);
    return { successCount: 0, suppressed: true };
  }


  try {
    const recipientUserIds = [];

    // 1. Identify Merchant Owner
    try {
      const merchant = $app.findRecordById("merchants", merchantId);
      const ownerId = merchant.getString("owner");
      if (ownerId && recipientUserIds.indexOf(ownerId) === -1) {
        recipientUserIds.push(ownerId);
      }
    } catch (mErr) {
      console.log("[PUSH] Merchant not found:", merchantId);
      return null;
    }

    // 2. Identify Branch Staff
    try {
      let staffFilter = `merchant_id = "${merchantId}"`;
      const staffList = $app.findRecordsByFilter("users", staffFilter, "-created", 100, 0);

      staffList.forEach(function(u) {
        const uBranchId = u.getString("branch");
        const uBranchName = (u.getString("branch_name") || "").toLowerCase().trim();

        // If no specific branch for claim, or staff has no specific branch (HQ), or staff matches claim branch
        let isEligible = true;
        if (branchId) {
          if (uBranchId && uBranchId !== branchId) {
            isEligible = false;
          }
        }

        if (isEligible && recipientUserIds.indexOf(u.id) === -1) {
          recipientUserIds.push(u.id);
        }
      });
    } catch (sErr) {
      console.log("[PUSH] Staff query error:", sErr.message || sErr);
    }

    if (recipientUserIds.length === 0) {
      console.log("[PUSH] No recipients resolved for merchant:", merchantId);
      return null;
    }

    // 3. Find push subscriptions for all resolved recipients
    const userFilterParts = recipientUserIds.map(function(uid) {
      return `user = "${uid}"`;
    });
    const subFilter = userFilterParts.join(" || ");

    const subs = $app.findRecordsByFilter(
      "push_subscriptions",
      subFilter,
      "-created",
      100,
      0
    );

    console.log(`[PUSH DISPATCH] Found ${subs.length} active subscription(s) for ${recipientUserIds.length} user(s) at merchant ${merchantId}`);
    return dispatchToPushService(subs, payload);
  } catch (err) {
    console.log("[SEND PUSH TO MERCHANT ERROR]", err.message || err);
    return null;
  }
}

module.exports = {
  sendPushToUser,
  sendPushToMerchant
};