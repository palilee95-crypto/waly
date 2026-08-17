// pb_hooks/subscription_checkout.pb.js
// In-App Subscription Checkout & Order Generation

routerAdd("POST", "/api/risev/merchant/subscription/checkout", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
  }

  const userRole = authRecord.getString("role");
  if (userRole !== "merchant" && userRole !== "both") {
    return e.json(403, { message: "Forbidden. Merchant access required." });
  }

  let merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    try {
      const owned = $app.findRecordsByFilter("merchants", `owner = "${authRecord.id}"`, "-created", 1, 0);
      if (owned.length > 0) merchantId = owned[0].id;
    } catch (err) {}
  }

  if (!merchantId) {
    return e.json(400, { message: "No merchant profile associated with this account." });
  }

  const body = e.requestInfo().body || {};
  const plan = (body.plan || "pro").toLowerCase(); // 'starter' | 'pro' | 'business'
  const billingCycle = (body.billing_cycle || "annually").toLowerCase(); // 'monthly' | 'annually'
  const paymentMethod = body.payment_method || "fpx"; // 'fpx' | 'card' | 'duitnow'

  // Pricing Matrix (in RM)
  const PRICING = {
    starter: { monthly: 47, annually: 456, quota: 500, title: "Starter Plan" },
    pro: { monthly: 97, annually: 936, quota: "unlimited", title: "PRO Plan" },
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
  }

  // Update subscription record with pending checkout intent
  subRecord.set("plan", plan === "business" ? "business" : (plan === "starter" ? "starter" : "pro"));
  subRecord.set("chipin_payment_id", orderId);
  subRecord.set("chipin_customer_email", authRecord.getString("email") || "");
  
  try {
    $app.save(subRecord);
  } catch (saveErr) {
    console.log("Error saving subscription checkout intent:", saveErr.message || saveErr);
  }

  console.log(`[SUBSCRIPTION CHECKOUT] Created order ${orderId} for merchant ${merchantId} (${selectedTier.title}, RM ${totalAmount}, ${paymentMethod.toUpperCase()})`);

  return e.json(200, {
    success: true,
    order_id: orderId,
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
