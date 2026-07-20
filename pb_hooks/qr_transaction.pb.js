// qr_transaction.pb.js
// QR code generation + validation + mark-sent for inbound stamp flow.

// ── Generate QR ────────────────────────────────────────────────────
routerAdd("POST", "/api/risev/qr/generate", (e) => {
  const auth = e.auth || e.requestInfo().authRecord;
  if (!auth) return e.json(401, { message: "Unauthorized" });

  const body = e.requestInfo().body;
  const billAmount = parseFloat(body.bill_amount) || 0;
  const stampAmount = parseInt(body.stamp_amount) || 0;

  if (billAmount < 0 || stampAmount < 1) {
    return e.json(400, { message: "Invalid amounts" });
  }

  // Find merchant owned by this user
  const merchants = $app.findRecordsByFilter("merchants", `owner = '${auth.id}'`, "created", 1, 0);
  if (merchants.length === 0) {
    return e.json(404, { message: "Merchant not found" });
  }
  const merchantId = merchants[0].id;

  // Generate unique tx code (8 chars, no ambiguous chars)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let txCode = "";
  for (let i = 0; i < 8; i++) {
    txCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Create qr_transaction record
  const tx = new Record($app.findCollectionByNameOrId("qr_transactions"), {
    merchant: merchantId,
    bill_amount: billAmount,
    stamp_amount: stampAmount,
    tx_code: txCode,
    status: "pending",
  });
  $app.save(tx);

  // Build QR URL
  const appUrl = $os.getenv("APP_URL") || "https://waly-five.vercel.app";
  const qrUrl = appUrl + "/join?m=" + merchantId + "&bill=" + billAmount + "&stamps=" + stampAmount + "&t=" + txCode;

  return e.json(200, {
    success: true,
    qrUrl: qrUrl,
    txCode: txCode,
    txId: tx.id
  });
});

// ── Validate QR ────────────────────────────────────────────────────
routerAdd("GET", "/api/risev/qr/validate", (e) => {
  const query = e.requestInfo().query;
  const txCode = query.t || "";
  const merchantId = query.m || "";

  if (!txCode || !merchantId) {
    return e.json(400, { message: "Missing parameters" });
  }

  const txs = $app.findRecordsByFilter("qr_transactions",
    `tx_code = '${txCode}' && merchant = '${merchantId}'`,
    "created", 1, 0);

  if (txs.length === 0) {
    return e.json(404, { message: "Invalid QR code" });
  }

  const tx = txs[0];
  const status = tx.getString("status");

  if (status === "completed") {
    return e.json(200, { valid: false, reason: "already_used" });
  }
  if (status === "expired") {
    return e.json(200, { valid: false, reason: "expired" });
  }

  // Fetch merchant details
  const merchant = $app.findRecordById("merchants", merchantId);
  const merchantName = merchant.getString("name") || "";
  
  // Get merchant owner's phone for WhatsApp (formatted with 60 country code)
  let merchantPhone = "";
  try {
    const owner = $app.findRecordById("users", merchant.getString("owner"));
    let rawPhone = owner.getString("phone") || "";
    let digits = rawPhone.replace(/[^\d]/g, '');
    if (digits.startsWith("0")) {
      digits = "6" + digits;
    }
    if (!digits.startsWith("60") && digits.length >= 9) {
      digits = "60" + digits;
    }
    merchantPhone = digits;
  } catch (err) {
    // fallback — no phone
  }

  return e.json(200, {
    valid: true,
    merchantName: merchantName,
    merchantPhone: merchantPhone,
    billAmount: tx.get("bill_amount"),
    stampAmount: tx.get("stamp_amount"),
  });
});

// ── Mark QR as sent (customer opened WhatsApp) ─────────────────────
routerAdd("POST", "/api/risev/qr/mark-sent", (e) => {
  const auth = e.auth || e.requestInfo().authRecord;
  if (!auth) return e.json(401, { message: "Unauthorized" });

  const body = e.requestInfo().body;
  const txCode = body.tx_code || "";
  const customerPhone = body.customer_phone || "";

  const txs = $app.findRecordsByFilter("qr_transactions",
    `tx_code = '${txCode}' && status = 'pending'`,
    "created", 1, 0);

  if (txs.length === 0) {
    return e.json(404, { message: "Transaction not found or already used" });
  }

  const tx = txs[0];
  tx.set("status", "sent");
  tx.set("customer", auth.id);
  tx.set("customer_phone", customerPhone);
  $app.save(tx);

  return e.json(200, { success: true });
});

// ── Public merchant branding (for /join page) ──────────────────────
routerAdd("GET", "/api/risev/qr/branding", (e) => {
  const query = e.requestInfo().query;
  const merchantId = query.m || "";
  if (!merchantId) return e.json(400, { message: "Missing merchant ID" });

  try {
    const merchant = $app.findRecordById("merchants", merchantId);
    return e.json(200, {
      merchantName: merchant.getString("name") || "",
      primaryColor: merchant.getString("onboarding_primary_color") || "#000000",
      welcomeText: merchant.getString("onboarding_welcome_text") || "",
      logoUrl: merchant.getString("onboarding_logo_url") || "",
    });
  } catch (err) {
    return e.json(404, { message: "Merchant not found" });
  }
});

// ── List recent QR transactions for merchant ───────────────────────
routerAdd("GET", "/api/risev/qr/list", (e) => {
  const auth = e.auth || e.requestInfo().authRecord;
  if (!auth) return e.json(401, { message: "Unauthorized" });

  const merchants = $app.findRecordsByFilter("merchants", `owner = '${auth.id}'`, "created", 1, 0);
  if (merchants.length === 0) {
    return e.json(200, { transactions: [] });
  }
  const merchantId = merchants[0].id;

  const txs = $app.findRecordsByFilter("qr_transactions",
    `merchant = '${merchantId}'`,
    "-created", 20, 0);

  const result = txs.map((tx) => ({
    id: tx.id,
    tx_code: tx.getString("tx_code"),
    bill_amount: tx.get("bill_amount"),
    stamp_amount: tx.get("stamp_amount"),
    status: tx.getString("status"),
    customer_phone: tx.getString("customer_phone") || "",
    created: tx.getString("created") || "",
    completed_at: tx.getString("completed_at") || "",
  }));

  return e.json(200, { transactions: result });
});