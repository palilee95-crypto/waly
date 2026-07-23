// pb_hooks/nfc_request.pb.js
// Endpoint for customer to submit an NFC stamp claim request directly via web

routerAdd("POST", "/api/risev/nfc/request", (e) => {
  try {
    const body = e.requestInfo().body || {};
    const merchantId = (body.merchant_id || body.merchant || "").trim();
    let rawPhone = (body.phone || body.customer_phone || "").trim();
    let name = (body.name || body.customer_name || "").trim();

    if (!merchantId) {
      return e.json(400, { message: "merchant_id is required" });
    }
    if (!rawPhone) {
      return e.json(400, { message: "customer phone number is required" });
    }

    // Verify merchant exists
    let merchant = null;
    try {
      merchant = $app.findRecordById("merchants", merchantId);
    } catch (err) {
      return e.json(404, { message: "Merchant not found" });
    }

    // Format phone number
    let digits = rawPhone.replace(/[^\d]/g, '');
    if (digits.indexOf("0") === 0) digits = "6" + digits;
    if (digits.indexOf("60") !== 0 && digits.length >= 9) digits = "60" + digits;
    const cleanPhone = "+" + digits;

    if (!name) {
      name = "Customer " + digits.slice(-4);
    }

    // Check if customer user record already exists
    let customerUser = null;
    const last8 = digits.slice(-8);
    if (last8) {
      try {
        const users = $app.findRecordsByFilter("users", `phone ~ '${last8}'`, "-created", 1, 0);
        if (users.length > 0) customerUser = users[0];
      } catch (err) { /* ignore */ }
    }

    // Generate random 6-character uppercase session code
    const sessionCode = $security.randomString(6).toUpperCase();

    // Check for any existing pending claim from this phone & merchant
    let claim = null;
    try {
      const existingClaims = $app.findRecordsByFilter(
        "nfc_claims",
        `merchant = '${merchantId}' && customer_phone = '${cleanPhone}' && (status = 'pending_whatsapp' || status = 'pending')`,
        "-created",
        1,
        0
      );
      if (existingClaims.length > 0) {
        claim = existingClaims[0];
        // Reuse existing claim record, update name and session_code
        claim.set("customer_name", name);
        claim.set("session_code", sessionCode);
        claim.set("status", "pending_whatsapp");
        if (customerUser) claim.set("customer", customerUser.id);
        $app.save(claim);
        console.log(`[NFC REQUEST] Updated existing claim ${claim.id} for merchant ${merchantId}, phone ${cleanPhone}`);
      }
    } catch (err) { /* create new below */ }

    if (!claim) {
      const claimCol = $app.findCollectionByNameOrId("nfc_claims");
      claim = new Record(claimCol);
      claim.set("id", $security.randomString(15).toLowerCase());
      claim.set("merchant", merchantId);
      claim.set("customer_phone", cleanPhone);
      claim.set("customer_name", name);
      claim.set("session_code", sessionCode);
      claim.set("status", "pending_whatsapp");
      if (customerUser) claim.set("customer", customerUser.id);
      $app.save(claim);
      console.log(`[NFC REQUEST] Created new pending_whatsapp claim ${claim.id} for merchant ${merchantId}, phone ${cleanPhone}`);
    }

    return e.json(200, {
      success: true,
      claim_id: claim.id,
      session_code: sessionCode,
      status: "pending_whatsapp",
      merchant_name: merchant.getString("name") || "Merchant"
    });
  } catch (err) {
    console.log("[NFC REQUEST ERROR]", err.message || err);
    return e.json(500, { message: "Failed to submit NFC claim request: " + (err.message || err) });
  }
});

// Endpoint called when customer clicks/opens WhatsApp to activate claim for merchant terminal
routerAdd("POST", "/api/risev/nfc/whatsapp-sent", (e) => {
  try {
    const body = e.requestInfo().body || {};
    const claimId = (body.claim_id || body.id || "").trim();

    if (!claimId) {
      return e.json(400, { message: "claim_id is required" });
    }

    const claim = $app.findRecordById("nfc_claims", claimId);
    claim.set("status", "pending"); // Now ready for merchant terminal approval!
    $app.save(claim);

    console.log(`[NFC WHATSAPP SENT] Claim ${claimId} marked as pending (ready for merchant approval).`);
    return e.json(200, { success: true, status: "pending", claim_id: claimId });
  } catch (err) {
    console.log("[NFC WHATSAPP SENT ERROR]", err.message || err);
    return e.json(500, { message: err.message || "Failed to update claim" });
  }
});
