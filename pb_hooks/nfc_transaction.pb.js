// pb_hooks/nfc_transaction.pb.js
// Endpoint for merchant to confirm bill amount & stamps for an NFC customer claim

routerAdd("POST", "/api/risev/nfc/complete", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized merchant authentication required" });
    }

    const body = e.requestInfo().body || {};
    const claimId = (body.claim_id || "").trim();
    const billAmount = parseFloat(body.bill_amount) || 0;
    const stampAmount = parseInt(body.stamp_amount) || 1;

    if (!claimId) {
      return e.json(400, { message: "claim_id is required" });
    }

    const claim = $app.findRecordById("nfc_claims", claimId);
    if (!claim) {
      return e.json(404, { message: "NFC claim record not found" });
    }

    if (claim.getString("status") === "completed") {
      return e.json(400, { message: "NFC claim has already been completed" });
    }

    const merchantId = claim.getString("merchant");
    const cleanPhone = claim.getString("customer_phone");
    const customerName = claim.getString("customer_name") || "there";

    // 1. Find or create user by phone
    let customer = null;
    if (cleanPhone) {
      const digits = cleanPhone.replace(/[^\d]/g, '');
      const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
      const phoneFilter = `phone = '${cleanPhone}' || phone = '${digits}' || phone = '${localDigits}'`;
      try {
        const users = $app.findRecordsByFilter("users", phoneFilter, "-created", 1, 0);
        if (users.length > 0) customer = users[0];
      } catch (err) { /* ignore */ }

      if (!customer) {
        try {
          const userCol = $app.findCollectionByNameOrId("users");
          customer = new Record(userCol);
          customer.set("id", $security.randomString(15).toLowerCase());
          customer.set("phone", cleanPhone);
          customer.set("email", `shadow_cust_${cleanPhone.replace(/[^\d]/g, '')}@risev.app`);
          customer.set("name", customerName);
          customer.set("role", "customer");
          customer.set("birthday", "2000-01-01 00:00:00.000Z");
          customer.setPassword($security.randomString(20));
          $app.save(customer);
        } catch (custErr) {
          console.log("[NFC COMPLETE] Failed to auto-create customer user:", custErr.message || custErr);
          customer = null;
        }
      }
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
    if (customer) {
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
      }

      const currentStamps = parseInt(card.get("stamps_collected")) || parseInt(card.get("stamps")) || 0;
      const totalStamps = currentStamps + stampAmount;
      card.set("stamps_collected", totalStamps);
      card.set("last_activity", new Date().toISOString().replace('T', ' ').substring(0, 19));
      $app.save(card);

      // 4. Record transaction
      try {
        const txnCol = $app.findCollectionByNameOrId("transactions");
        const txn = new Record(txnCol);
        txn.set("id", $security.randomString(15).toLowerCase());
        txn.set("type", "earn");
        txn.set("stamps", stampAmount);
        txn.set("bill_amount", billAmount);
        txn.set("customer", customer.id);
        txn.set("merchant", merchantId);
        txn.set("loyalty_card", card.id);
        txn.set("metadata", JSON.stringify({ source: "nfc_claim", claim_id: claimId }));
        $app.save(txn);
      } catch (txnErr) {
        console.log("[NFC COMPLETE] Transaction error:", txnErr.message || txnErr);
      }

      // 5. Update nfc_claim record to completed
      claim.set("status", "completed");
      claim.set("bill_amount", billAmount);
      claim.set("stamp_amount", stampAmount);
      if (customer) claim.set("customer", customer.id);
      claim.set("completed_at", new Date().toISOString().replace('T', ' ').substring(0, 19));
      $app.save(claim);

      // 6. Transaction completed - welcome_notification.pb.js handles sending the WhatsApp receipt
      console.log(`[NFC COMPLETE] Completed claim for customer ${customerName} (${cleanPhone}), total stamps: ${totalStamps}/${goal}`);

      return e.json(200, {
        success: true,
        message: "Stamps issued successfully",
        totalStamps: totalStamps,
        goal: goal
      });
    }

    return e.json(400, { message: "Failed to process customer for NFC claim" });
  } catch (err) {
    return e.json(500, { message: "Failed to complete NFC claim: " + (err.message || err) });
  }
});
