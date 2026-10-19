// pb_hooks/quota_addons.pb.js
// Customer-slot top-ups for Stand Bundle merchants.
//
// Routes:
//   GET  /api/risev/merchant/quota/packages  -> packages + current usage
//   POST /api/risev/merchant/quota/checkout  -> Chip In purchase for a block
//
// Helpers live in the required module (quota_addons.js) because hook handlers
// cannot see file-level declarations in this file.

routerAdd("GET", "/api/risev/merchant/quota/packages", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized. Please log in first." });
    }

    const quota = require(`${__hooks}/quota_addons.js`);

    let merchantId = authRecord.getString("merchant_id");
    if (!merchantId) {
      const owned = $app.findRecordsByFilter("merchants", `owner = '${authRecord.id}'`, "-created", 1, 0);
      if (owned.length > 0) merchantId = owned[0].id;
    }
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile associated with this account." });
    }

    let plan = "";
    try {
      const subs = $app.findRecordsByFilter(
        "subscriptions",
        `merchant = '${merchantId}' && status = 'active'`,
        "-created",
        1,
        0
      );
      if (subs.length > 0) plan = subs[0].getString("plan");
    } catch (subErr) {
      console.log("[QUOTA ADDONS] Subscription lookup failed:", subErr.message || subErr);
    }

    return e.json(200, {
      success: true,
      packages: quota.PACKAGES,
      current: quota.getQuotaState(merchantId, plan),
      eligible: plan === "stand_bundle"
    });
  } catch (err) {
    console.log("[QUOTA ADDONS] packages error:", err.message || err);
    return e.json(500, { message: "Failed to load quota packages." });
  }
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/risev/merchant/quota/checkout", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized. Please log in first." });
    }

    const quota = require(`${__hooks}/quota_addons.js`);

    let merchantId = authRecord.getString("merchant_id");
    if (!merchantId) {
      const owned = $app.findRecordsByFilter("merchants", `owner = '${authRecord.id}'`, "-created", 1, 0);
      if (owned.length > 0) {
        merchantId = owned[0].id;
        authRecord.set("merchant_id", merchantId);
        $app.save(authRecord);
      }
    }
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile associated with this account." });
    }

    // Only Stand Bundle can buy slots (PRO/Business are unlimited, Starter is per-cycle).
    let activeSub = null;
    try {
      const subs = $app.findRecordsByFilter(
        "subscriptions",
        `merchant = '${merchantId}' && status = 'active'`,
        "-created",
        1,
        0
      );
      if (subs.length > 0) activeSub = subs[0];
    } catch (subErr) {}
    if (!activeSub) {
      return e.json(400, { message: "An active subscription is required to buy customer slots." });
    }
    const plan = (activeSub.getString("plan") || "").toLowerCase();
    if (plan === "pro" || plan === "business" || plan === "enterprise") {
      return e.json(400, { message: "Your plan already includes unlimited customers." });
    }
    if (plan !== "stand_bundle") {
      return e.json(400, { message: "Customer slots can only be added to the Stand Bundle." });
    }

    const body = e.requestInfo().body || {};
    const pkg = quota.findPackage(body.package_id);
    if (!pkg) {
      return e.json(400, { message: "Invalid customer-slot package." });
    }

    // Abandoned checkouts: cancel older pending top-ups for this merchant.
    try {
      const pending = $app.findRecordsByFilter(
        "merchant_addons",
        `merchant = '${merchantId}' && type = 'customer_quota' && status = 'pending'`,
        "-created",
        50,
        0
      );
      for (let i = 0; i < pending.length; i++) {
        pending[i].set("status", "cancelled");
        $app.save(pending[i]);
      }
    } catch (pErr) {
      console.log("[QUOTA ADDONS] Pending cleanup warning:", pErr.message || pErr);
    }

    const orderId = `QUOTA-${merchantId.substring(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const productName = `Risev Customer Slots (${pkg.quantity.toLocaleString()} Members)`;

    const addonCol = $app.findCollectionByNameOrId("merchant_addons");
    const addon = new Record(addonCol);
    addon.set("id", $security.randomString(15).toLowerCase());
    addon.set("merchant", merchantId);
    addon.set("type", "customer_quota");
    addon.set("quantity", pkg.quantity);
    addon.set("status", "pending");
    addon.set("order_ref", orderId);
    addon.set("payment_provider", "chipin");
    addon.set("amount", pkg.price);
    addon.set("unit_price", Math.round((pkg.price / pkg.quantity) * 100) / 100);
    addon.set("note", productName);

    // Chip In Direct API (same shape as subscription_checkout.pb.js).
    const chipinBrandId = process.env.CHIPIN_BRAND_ID || "";
    const chipinApiKey = process.env.CHIPIN_API_KEY || "";
    let paymentUrl = "";

    if (chipinBrandId && chipinApiKey) {
      try {
        const chipRes = $http.send({
          url: "https://gate.chip-in.asia/api/v1/purchases/",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${chipinApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            brand_id: chipinBrandId,
            client: {
              email: authRecord.getString("email") || "merchant@risev.app",
              phone: authRecord.getString("phone") || "",
              full_name: authRecord.getString("name") || "Store Owner"
            },
            purchase: {
              currency: "MYR",
              products: [
                {
                  name: productName,
                  price: Math.round(pkg.price * 100),
                  quantity: 1
                }
              ]
            },
            reference: orderId,
            success_redirect: `https://risev.app/subscription?topup=success&order_id=${orderId}`,
            failure_redirect: `https://risev.app/subscription?status=failed&order_id=${orderId}`,
            cancel_redirect: `https://risev.app/subscription?status=cancelled&order_id=${orderId}`
          }),
          timeout: 15
        });

        if (chipRes.statusCode === 200 || chipRes.statusCode === 201) {
          const purchaseData = chipRes.json;
          paymentUrl = purchaseData.checkout_url || "";
          if (purchaseData.id) {
            addon.set("payment_ref", purchaseData.id);
          }
          console.log(`[QUOTA CHECKOUT] Created purchase ${purchaseData.id} for ${orderId}`);
        } else {
          console.log(`[QUOTA CHECKOUT ERROR] Gateway returned ${chipRes.statusCode}:`, chipRes.raw);
        }
      } catch (chipErr) {
        console.log("[QUOTA CHECKOUT] Chip In error:", chipErr.message || chipErr);
      }
    }

    $app.save(addon);
    console.log(`[QUOTA CHECKOUT] Pending ${pkg.quantity} slots for merchant ${merchantId} (RM ${pkg.price}, ${orderId})`);

    return e.json(200, {
      success: true,
      order_id: orderId,
      payment_url: paymentUrl,
      package_id: pkg.id,
      quantity: pkg.quantity,
      amount: pkg.price,
      currency: "MYR",
      message: `Order for ${pkg.label} generated successfully.`
    });
  } catch (err) {
    console.log("[QUOTA CHECKOUT] error:", err.message || err);
    return e.json(500, { message: "Failed to start the customer-slot purchase." });
  }
}, $apis.requireAuth("users"));
