// pb_hooks/chipin_webhook.pb.js
// Chip In Payment Gateway Webhook Handler

routerAdd("POST", "/api/risev/chipin-webhook", (c) => {
  try {
    const body = c.requestInfo().body || {};
    const headers = c.requestInfo().headers || {};

    console.log("[CHIPIN WEBHOOK RECEIVED]", JSON.stringify(body));

    const eventType = body.event_type || "";
    const paymentStatus = (body.status || "").toLowerCase();
    const purchaseId = body.id || "";
    const orderReference = body.reference || "";

    // Verify event is successful payment
    const isPaid = eventType === "purchase.paid" || 
                   paymentStatus === "paid" || 
                   paymentStatus === "cleared" || 
                   paymentStatus === "settled";

    if (!isPaid) {
      console.log(`[CHIPIN WEBHOOK] Non-paid status (${paymentStatus}/${eventType}), ignoring.`);
      return c.json(200, { success: true, message: "Ignored non-paid event" });
    }

    // Locate subscription record
    let subRecord = null;
    if (purchaseId) {
      try {
        const byId = $app.findRecordsByFilter("subscriptions", `chipin_payment_id = "${purchaseId}"`, "-created", 1, 0);
        if (byId.length > 0) subRecord = byId[0];
      } catch (e) {}
    }

    if (!subRecord && orderReference) {
      try {
        const byRef = $app.findRecordsByFilter("subscriptions", `chipin_payment_id = "${orderReference}"`, "-created", 1, 0);
        if (byRef.length > 0) subRecord = byRef[0];
      } catch (e) {}
    }

    if (!subRecord && body.client?.email) {
      try {
        const byEmail = $app.findRecordsByFilter("subscriptions", `chipin_customer_email = "${body.client.email}"`, "-created", 1, 0);
        if (byEmail.length > 0) subRecord = byEmail[0];
      } catch (e) {}
    }

    if (!subRecord) {
      let merchantId = "";
      // 1. Try finding user by client email or phone
      if (body.client?.email) {
        try {
          const users = $app.findRecordsByFilter("users", `email = "${body.client.email}"`, "-created", 1, 0);
          if (users.length > 0) merchantId = users[0].getString("merchant_id");
        } catch (e) {}
      }
      if (!merchantId && body.client?.phone) {
        try {
          const rawPhone = body.client.phone.replace(/[^0-9]/g, "");
          const users = $app.findRecordsByFilter("users", `phone ~ "${rawPhone}"`, "-created", 1, 0);
          if (users.length > 0) merchantId = users[0].getString("merchant_id");
        } catch (e) {}
      }
      // 2. Try parsing merchant prefix from SUB-<PREFIX>-...
      if (!merchantId && orderReference && orderReference.startsWith("SUB-")) {
        const parts = orderReference.split("-");
        if (parts.length >= 2) {
          const prefix = parts[1].toLowerCase();
          try {
            const merchants = $app.findRecordsByFilter("merchants", `id ~ "${prefix}"`, "-created", 1, 0);
            if (merchants.length > 0) merchantId = merchants[0].id;
          } catch (e) {}
        }
      }

      if (merchantId) {
        try {
          const subs = $app.findRecordsByFilter("subscriptions", `merchant = "${merchantId}"`, "-created", 1, 0);
          if (subs.length > 0) {
            subRecord = subs[0];
          } else {
            const subCol = $app.findCollectionByNameOrId("subscriptions");
            subRecord = new Record(subCol);
            subRecord.set("id", $security.randomString(15).toLowerCase());
            subRecord.set("merchant", merchantId);
            subRecord.set("status", "pending");
          }
        } catch (e) {}
      }
    }

    if (!subRecord) {
      console.log(`[CHIPIN WEBHOOK WARNING] No subscription found for purchase ${purchaseId} / ref ${orderReference}`);
      return c.json(200, { success: false, message: "Subscription record not found" });
    }

    // Determine plan and duration from purchase products / reference
    const currentPlan = subRecord.getString("plan") || "pro";
    let periodDays = 30; // default monthly

    const products = body.purchase?.products || [];
    const prodName = products.length > 0 ? (products[0].name || "").toLowerCase() : "";

    if (prodName.includes("annual") || prodName.includes("year") || orderReference.includes("ANNUAL")) {
      periodDays = 365;
    }
    if (prodName.includes("starter")) {
      subRecord.set("plan", "starter");
    } else if (prodName.includes("business") || prodName.includes("enterprise")) {
      subRecord.set("plan", "business");
    } else if (prodName.includes("pro")) {
      subRecord.set("plan", "pro");
    }

    const currentPeriodEnd = new Date(Date.now() + periodDays * 86400000).toISOString();

    // Activate subscription
    subRecord.set("status", "active");
    subRecord.set("current_period_end", currentPeriodEnd);
    subRecord.set("chipin_payment_id", purchaseId || orderReference);
    if (body.client?.email) {
      subRecord.set("chipin_customer_email", body.client.email);
    }

    $app.save(subRecord);
    console.log(`[CHIPIN WEBHOOK] Activated subscription ${subRecord.id} for merchant ${subRecord.getString("merchant")} (Plan: ${subRecord.getString("plan")}, Valid: ${periodDays} days)`);

    // Sync merchant status
    const merchantId = subRecord.getString("merchant");
    if (merchantId) {
      try {
        const merch = $app.findRecordById("merchants", merchantId);
        if (merch) {
          merch.set("status", "active");
          $app.save(merch);
        }
      } catch (mErr) {
        console.log("[CHIPIN WEBHOOK] Failed to update merchant record:", mErr.message);
      }
    }

    return c.json(200, {
      success: true,
      message: "Subscription successfully activated via Chip In",
      subscription_id: subRecord.id,
      plan: subRecord.getString("plan"),
      period_end: currentPeriodEnd
    });
  } catch (err) {
    console.log("[CHIPIN WEBHOOK ERROR]", err.message || err);
    return c.json(500, { success: false, message: "Internal server error: " + err.message });
  }
});
