// pb_hooks/manual_give.pb.js
// Endpoint for merchant to manually issue stamps to a customer by phone number

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
    const last8 = digits.slice(-8);
    let customer = null;
    try {
      const users = $app.findRecordsByFilter("users", `phone ~ '${last8}'`, "-created", 1, 0);
      if (users.length > 0) customer = users[0];
    } catch (err) { /* ignore */ }

    if (!customer) {
      const userCol = $app.findCollectionByNameOrId("users");
      customer = new Record(userCol);
      customer.set("id", $security.randomString(15).toLowerCase());
      customer.set("phone", cleanPhone);
      customer.set("email", `customer_${digits}@risev.app`);
      customer.set("name", customerNameInput || ("Customer " + digits.slice(-4)));
      customer.set("role", "customer");
      customer.set("birthday", "2000-01-01 00:00:00.000Z");
      customer.setPassword($security.randomString(20));
      $app.save(customer);
    }

    // 2. Find or auto-create merchant's loyalty program
    const programs = $app.findRecordsByFilter("loyalty_programs", `merchant = '${merchantId}'`, "created", 1, 0);
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
      $app.save(program);
    }

    const programId = program.id;
    const goal = parseInt(program.get("stamp_goal")) || 10;

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
      $app.save(card);
    }

    const currentStamps = parseInt(card.get("stamps_collected")) || parseInt(card.get("stamps")) || 0;
    const totalStamps = currentStamps + stampAmount;
    card.set("stamps_collected", totalStamps);
    card.set("last_activity", new Date().toISOString().replace('T', ' ').substring(0, 19));
    $app.save(card);

    // 4. Record transaction
    const txnCol = $app.findCollectionByNameOrId("transactions");
    const txn = new Record(txnCol);
    txn.set("id", $security.randomString(15).toLowerCase());
    txn.set("type", "earn");
    txn.set("stamps", stampAmount);
    txn.set("bill_amount", billAmount);
    txn.set("customer", customer.id);
    txn.set("merchant", merchantId);
    txn.set("metadata", JSON.stringify({ source: "manual_give" }));
    $app.save(txn);

    // 5. Send automated WhatsApp receipt to customer
    const merchant = $app.findRecordById("merchants", merchantId);
    const storeName = merchant.getString("name") || "our store";
    const appUrl = $os.getenv("APP_URL") || "https://waly-five.vercel.app";
    const customerName = customer.getString("name") || "there";
    const nameSlug = (storeName || "").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const instanceName = `merchant-${merchantId}-${nameSlug}`;
    const { sendTextMessage } = require(`${__hooks}/whatsapp_helper.js`);

    let replyMsg = "";
    if (totalStamps >= goal) {
      const remaining = totalStamps % goal;
      replyMsg = `Hi ${customerName}! 🎉 You earned ${stampAmount} stamp(s) at *${storeName}* and completed your card!\n\nA reward voucher has been added to your account. Your new balance: ${remaining}/${goal} stamp(s).\n\nView your card & rewards here:\n${appUrl}`;
    } else {
      replyMsg = `Hi ${customerName}! ${stampAmount} stamp(s) added from *${storeName}*! 🎉\n\nYou now have *${totalStamps}/${goal} stamps*.\n\nCheck your card & rewards balance here:\n${appUrl}`;
    }

    try {
      sendTextMessage(instanceName, cleanPhone.replace('+', ''), replyMsg, { delay: 1000, presence: 'composing' });
      console.log(`[MANUAL GIVE] WhatsApp receipt sent to ${cleanPhone}: "${replyMsg}"`);
    } catch (replyErr) {
      console.log("[MANUAL GIVE] Auto-reply failed:", replyErr.message || replyErr);
    }

    return e.json(200, {
      success: true,
      message: `${stampAmount} stamp(s) issued to ${customerName}`,
      customerName: customerName,
      phone: cleanPhone,
      totalStamps: totalStamps,
      goal: goal
    });
  } catch (err) {
    return e.json(500, { message: "Failed to manually issue stamps: " + (err.message || err) });
  }
});
