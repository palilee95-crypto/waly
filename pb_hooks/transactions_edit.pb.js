/// <reference path="../pb_data/types.d.ts" />
// Merchants can correct a bill amount after the fact (typos at the counter).
// `transactions.updateRule` is null, so this route is the only write path: it
// verifies the caller owns or works at the merchant, then changes ONLY
// bill_amount and records an audit trail in metadata. Points and stamps are
// deliberately left alone — they were credited at claim time.

routerAdd("POST", "/api/risev/merchant/transactions/bill", (e) => {
  const auth = e.auth;
  if (!auth) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
  }

  const body = e.requestInfo().body || {};
  const txnId = String(body.transaction_id || "").trim();
  if (!txnId) {
    return e.json(400, { message: "transaction_id is required." });
  }

  const raw = body.bill_amount;
  const amount = Number(raw);
  if (raw === undefined || raw === null || raw === "" || isNaN(amount) || amount < 0) {
    return e.json(400, { message: "bill_amount must be a number greater than or equal to 0." });
  }

  let txn;
  try {
    txn = $app.findRecordById("transactions", txnId);
  } catch (err) {
    return e.json(404, { message: "Transaction not found." });
  }

  const merchantId = txn.getString("merchant");
  let merchant = null;
  try {
    merchant = $app.findFirstRecordByData("merchants", "id", merchantId);
  } catch (mErr) {
    return e.json(404, { message: "Merchant not found." });
  }

  const isOwner = merchant.getString("owner") === auth.id;
  const isMerchantAccount = auth.getString("merchant_id") === merchantId;
  if (!isOwner && !isMerchantAccount) {
    return e.json(403, { message: "You can only edit transactions for your own store." });
  }

  let meta = {};
  try {
    // getString() returns the JSON text; get() would hand back a Go []byte.
    const rawText = txn.getString("metadata");
    const parsed = rawText ? JSON.parse(rawText) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      meta = parsed;
    }
  } catch (metaErr) {
    meta = {};
  }

  const previous = Number(txn.get("bill_amount")) || 0;
  meta.bill_previous = previous;
  meta.bill_edited_at = new Date().toISOString();
  meta.bill_edited_by = auth.id;

  txn.set("bill_amount", amount);
  txn.set("metadata", JSON.stringify(meta));

  try {
    $app.save(txn);
  } catch (saveErr) {
    return e.json(500, { message: "Could not save the bill amount: " + (saveErr.message || saveErr) });
  }

  console.log(`[TXN BILL EDIT] ${txn.id} ${previous} -> ${amount} by ${auth.id}`);

  return e.json(200, {
    success: true,
    transaction_id: txn.id,
    bill_amount: amount,
    previous: previous,
  });
}, $apis.requireAuth("users"));
