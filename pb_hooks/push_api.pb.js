// pb_hooks/push_api.pb.js
// API endpoints for Web Push VAPID key exchange, subscription, and testing

routerAdd("GET", "/api/risev/push/vapid-key", (e) => {
  try {
    const pushServiceUrl = $os.getenv("PUSH_SERVICE_URL") || "http://push:3000";
    let res = null;

    try {
      res = $http.send({
        url: `${pushServiceUrl}/vapid-public-key`,
        method: "GET",
        headers: { "Content-Type": "application/json" },
        timeout: 5
      });
    } catch (netErr) {
      // Fallback to localhost if running in local development outside docker network
      try {
        res = $http.send({
          url: "http://localhost:3000/vapid-public-key",
          method: "GET",
          headers: { "Content-Type": "application/json" },
          timeout: 5
        });
      } catch (e2) {
        // Fallback to environment variable if set
        const envKey = $os.getenv("VAPID_PUBLIC_KEY");
        if (envKey) {
          return e.json(200, { success: true, publicKey: envKey });
        }
        return e.json(503, { message: "Push service unreachable: " + (netErr.message || netErr) });
      }
    }

    if (res && res.statusCode === 200) {
      const data = JSON.parse(res.raw);
      return e.json(200, { success: true, publicKey: data.publicKey });
    }

    return e.json(500, { message: "Failed to retrieve VAPID key from push service" });
  } catch (err) {
    return e.json(500, { message: err.message || "Internal error" });
  }
});

routerAdd("POST", "/api/risev/push/subscribe", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized" });
  }

  try {
    const body = e.requestInfo().body || {};
    const endpoint = (body.endpoint || "").trim();
    const keys = body.keys || {};
    const p256dh = (keys.p256dh || body.p256dh || "").trim();
    const auth = (keys.auth || body.auth || "").trim();
    const device = (body.device || body.user_agent || "").trim();
    const branchId = (body.branch_id || authRecord.getString("branch") || "").trim();
    const merchantId = (authRecord.getString("merchant_id") || body.merchant_id || "").trim();

    if (!endpoint || !p256dh || !auth) {
      return e.json(400, { message: "endpoint, keys.p256dh, and keys.auth are required" });
    }

    // Check if this endpoint already exists
    let existingSub = null;
    try {
      const safeEndpoint = endpoint.replace(/["'\\]/g, "");
      const subs = $app.findRecordsByFilter(
        "push_subscriptions",
        `endpoint = "${safeEndpoint}"`,
        "-created",
        1,
        0
      );
      if (subs.length > 0) existingSub = subs[0];
    } catch (err) {}

    if (existingSub) {
      existingSub.set("user", authRecord.id);
      if (merchantId) existingSub.set("merchant", merchantId);
      if (branchId) existingSub.set("branch", branchId);
      existingSub.set("p256dh", p256dh);
      existingSub.set("auth", auth);
      if (device) existingSub.set("device", device);
      $app.save(existingSub);
      console.log(`[PUSH API] Updated existing push subscription for user ${authRecord.id}`);
      return e.json(200, { success: true, subscription_id: existingSub.id, message: "Subscription updated" });
    }

    const subCol = $app.findCollectionByNameOrId("push_subscriptions");
    const newSub = new Record(subCol);
    newSub.set("id", $security.randomString(15).toLowerCase());
    newSub.set("user", authRecord.id);
    if (merchantId) newSub.set("merchant", merchantId);
    if (branchId) newSub.set("branch", branchId);
    newSub.set("endpoint", endpoint);
    newSub.set("p256dh", p256dh);
    newSub.set("auth", auth);
    if (device) newSub.set("device", device);
    $app.save(newSub);

    console.log(`[PUSH API] Created new push subscription ${newSub.id} for user ${authRecord.id}`);
    return e.json(200, { success: true, subscription_id: newSub.id, message: "Subscribed successfully" });
  } catch (err) {
    console.error("[PUSH API SUBSCRIBE ERROR]", err);
    return e.json(500, { message: "Failed to save push subscription: " + (err.message || err) });
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/risev/push/unsubscribe", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized" });
  }

  try {
    const body = e.requestInfo().body || {};
    const endpoint = (body.endpoint || "").trim();

    if (!endpoint) {
      return e.json(400, { message: "endpoint is required" });
    }

    const safeEndpoint = endpoint.replace(/["'\\]/g, "");
    const subs = $app.findRecordsByFilter(
      "push_subscriptions",
      `endpoint = "${safeEndpoint}" && user = "${authRecord.id}"`,
      "-created",
      10,
      0
    );

    subs.forEach(s => {
      try {
        $app.delete(s);
      } catch (e) {}
    });

    return e.json(200, { success: true, message: "Unsubscribed successfully" });
  } catch (err) {
    return e.json(500, { message: err.message || "Failed to unsubscribe" });
  }
}, $apis.requireAuth("users"));

// Test push endpoint for merchant to verify device
routerAdd("POST", "/api/risev/push/test", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized" });
  }

  try {
    const pushHelper = require(`${__hooks}/push_notify.js`);
    const result = pushHelper.sendPushToUser(authRecord.id, {
      title: "Risev Test Notification 🔔",
      body: "Web Push is working! You will now receive instant alerts when customers tap NFC.",
      url: "/(merchant)",
      tag: "test-alert"
    });

    return e.json(200, { success: true, result });
  } catch (err) {
    return e.json(500, { message: err.message || "Test push failed" });
  }
}, $apis.requireAuth("users"));
