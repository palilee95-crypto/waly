// pb_hooks/chipin_webhook.pb.js

routerAdd("POST", "/api/risev/chipin-webhook", (c) => {
  try {
    const data = c.requestInfo().body;
    const paymentId = data.id || data.payment_id;
    const status = data.status; // "paid" or "success"
    const email = data.email || "";
    const merchantId = data.reference; // reference contains the merchant ID

    if (!merchantId) {
      return c.json(400, { success: false, error: "Missing merchant reference" });
    }

    if (status === "paid" || status === "success" || status === "successful") {
      // 1. Fetch merchant and verify existence
      const merchant = $app.findRecordById("merchants", merchantId);
      
      // 2. Update merchant status to active
      merchant.set("status", "active");
      $app.save(merchant);

      // 3. Create or update subscription record
      const subsCol = $app.findCollectionByNameOrId("subscriptions");
      
      let sub;
      try {
        sub = $app.findFirstRecordByFilter("subscriptions", `chipin_payment_id = "${paymentId}"`);
      } catch (e) {
        sub = new Record(subsCol);
      }

      // Calculate current_period_end (30 days from now in PocketBase datetime format)
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + 30);
      const periodEndStr = periodEnd.toISOString().replace('T', ' ').substring(0, 19);

      sub.set("merchant", merchantId);
      sub.set("status", "active");
      sub.set("plan", "pro");
      sub.set("chipin_payment_id", paymentId);
      sub.set("chipin_customer_email", email);
      sub.set("current_period_end", periodEndStr);
      sub.set("cancel_at_period_end", false);

      $app.save(sub);
      
      console.log("Chip-in subscription processed successfully for merchant:", merchantId);
    }
    
    return c.json(200, { success: true });
  } catch (err) {
    console.log("Chip-in webhook error:", err.message || err);
    return c.json(400, { success: false, error: err.message || err });
  }
});
