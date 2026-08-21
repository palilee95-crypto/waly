// pb_hooks/subscription_checkout.pb.js
// In-App Subscription Checkout & Chip In Order Generation

routerAdd("POST", "/api/risev/merchant/subscription/checkout", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
  }

  let merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    try {
      const owned = $app.findRecordsByFilter("merchants", `owner = "${authRecord.id}"`, "-created", 1, 0);
      if (owned.length > 0) {
        merchantId = owned[0].id;
        authRecord.set("merchant_id", merchantId);
        $app.save(authRecord);
      }
    } catch (err) {}
  }

  if (!merchantId) {
    try {
      const merchantCol = $app.findCollectionByNameOrId("merchants");
      const newMerchant = new Record(merchantCol);
      newMerchant.set("id", $security.randomString(15).toLowerCase());
      newMerchant.set("name", authRecord.getString("name") || "My Store");
      newMerchant.set("owner", authRecord.id);
      newMerchant.set("status", "pending");
      $app.save(newMerchant);
      merchantId = newMerchant.id;
      authRecord.set("merchant_id", merchantId);
      $app.save(authRecord);
    } catch (createErr) {
      return e.json(400, { message: "Failed to initialize merchant profile." });
    }
  }

  const body = e.requestInfo().body || {};
  const plan = (body.plan || "pro").toLowerCase(); // 'starter' | 'pro' | 'business'
  const billingCycle = (body.billing_cycle || "annually").toLowerCase(); // 'monthly' | 'annually'
  const paymentMethod = body.payment_method || "fpx"; // 'fpx' | 'card' | 'duitnow'

  // Pricing Matrix (in RM)
  const PRICING = {
    starter: { monthly: 47, annually: 456, quota: 500, title: "Starter Plan" },
    pro: { monthly: 78, annually: 748, quota: "unlimited", title: "PRO Plan" },
    business: { monthly: 329, annually: 3156, quota: "unlimited", title: "Business Plan" }
  };

  const selectedTier = PRICING[plan] || PRICING.pro;
  const totalAmount = billingCycle === "monthly" ? selectedTier.monthly : selectedTier.annually;
  const orderId = `SUB-${merchantId.substring(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  // Period duration
  const periodDays = billingCycle === "monthly" ? 30 : 365;
  const periodEndDate = new Date(Date.now() + periodDays * 86400000).toISOString();

  // Find or create subscription record
  let subRecord = null;
  try {
    const existing = $app.findRecordsByFilter("subscriptions", `merchant = "${merchantId}"`, "-created", 1, 0);
    if (existing.length > 0) {
      subRecord = existing[0];
    }
  } catch (findErr) {}

  const subCol = $app.findCollectionByNameOrId("subscriptions");
  if (!subRecord) {
    subRecord = new Record(subCol);
    subRecord.set("id", $security.randomString(15).toLowerCase());
    subRecord.set("merchant", merchantId);
    subRecord.set("status", "pending");
  } else if (!subRecord.getString("status")) {
    subRecord.set("status", "pending");
  }

  // Update subscription record with pending checkout intent
  subRecord.set("plan", plan === "business" ? "business" : (plan === "starter" ? "starter" : "pro"));
  subRecord.set("chipin_payment_id", orderId);
  subRecord.set("chipin_customer_email", authRecord.getString("email") || "");

  // Call Chip In Direct API if credentials are configured
  const chipinBrandId = process.env.CHIPIN_BRAND_ID || "";
  const chipinApiKey = process.env.CHIPIN_API_KEY || "";
  let paymentUrl = "";

  if (chipinBrandId && chipinApiKey) {
    try {
      const priceInCents = Math.round(totalAmount * 100);
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
                name: `Risev ${selectedTier.title} (${billingCycle.toUpperCase()})`,
                price: priceInCents,
                quantity: 1
              }
            ]
          },
          reference: orderId,
          success_redirect: `https://risev.app/subscription?status=success&order_id=${orderId}`,
          failure_redirect: `https://risev.app/subscription?status=failed&order_id=${orderId}`,
          cancel_redirect: `https://risev.app/subscription?status=cancelled`
        }),
        timeout: 15
      });

      if (chipRes.statusCode === 200 || chipRes.statusCode === 201) {
        const purchaseData = chipRes.json;
        paymentUrl = purchaseData.checkout_url || "";
        if (purchaseData.id) {
          subRecord.set("chipin_payment_id", purchaseData.id);
        }
        console.log(`[CHIPIN CHECKOUT] Created purchase ${purchaseData.id} for order ${orderId}: ${paymentUrl}`);
      } else {
        console.log(`[CHIPIN CHECKOUT ERROR] Gateway returned ${chipRes.statusCode}:`, chipRes.raw);
      }
    } catch (chipErr) {
      console.log("[CHIPIN API ERROR]", chipErr.message || chipErr);
    }
  }

  try {
    $app.save(subRecord);
  } catch (saveErr) {
    console.log("Error saving subscription checkout intent:", saveErr.message || saveErr);
  }

  console.log(`[SUBSCRIPTION CHECKOUT] Created order ${orderId} for merchant ${merchantId} (${selectedTier.title}, RM ${totalAmount}, ${paymentMethod.toUpperCase()})`);

  return e.json(200, {
    success: true,
    order_id: orderId,
    payment_url: paymentUrl,
    plan: plan,
    plan_title: selectedTier.title,
    billing_cycle: billingCycle,
    amount: totalAmount,
    currency: "MYR",
    payment_method: paymentMethod,
    expires_at: periodEndDate,
    message: `Order for ${selectedTier.title} (${billingCycle}) generated successfully.`
  });
}, $apis.requireAuth("users"));
