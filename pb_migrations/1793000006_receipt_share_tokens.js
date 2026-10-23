/// <reference path="../pb_data/types.d.ts" />
// Receipts used to be readable by anyone who knew the record id (viewRule "").
// A database id is not a credential: it appears in links, screenshots and shared
// chats, and it exposes the customer's name, phone and purchase.
//
// Each receipt now carries an unguessable `share_token`. The public receipt page
// goes through GET /api/risev/receipt/public?token=… which returns only the fields
// a receipt needs, and the collection itself is restricted to the customer who
// owns it, the merchant owner and that merchant's staff.
migrate((app) => {
  const receipts = app.findCollectionByNameOrId("digital_receipts");

  // 1. Column first (PocketBase builds indexes before new columns otherwise).
  // getByName returns a falsy value for a missing field; it does not throw.
  let exists = false;
  try {
    exists = !!receipts.fields.getByName("share_token");
  } catch (missing) {
    exists = false;
  }
  if (!exists) {
    receipts.fields.add(new Field({
      id: "text_receipt_share_token",
      name: "share_token",
      type: "text",
      required: false,
      max: 64
    }));
    app.save(receipts);
    console.log("[MIGRATION 1793000006] Added digital_receipts.share_token");
  }

  // 2. Backfill existing receipts so their links keep working.
  let scanned = 0;
  let filled = 0;
  let offset = 0;
  while (true) {
    const batch = app.findRecordsByFilter("digital_receipts", "1=1", "created", 200, offset);
    if (!batch.length) break;
    for (let i = 0; i < batch.length; i++) {
      const rec = batch[i];
      scanned++;
      if (!rec.getString("share_token")) {
        rec.set("share_token", $security.randomString(24));
        app.save(rec);
        filled++;
      }
    }
    if (batch.length < 200) break;
    offset += batch.length;
  }
  console.log("[MIGRATION 1793000006] Share tokens: " + filled + " created, " + scanned + " receipts scanned");

  // 3. Index after the column exists.
  receipts.indexes = receipts.indexes || [];
  const shareIndex = "CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_share_token ON digital_receipts(share_token) WHERE share_token != ''";
  if (receipts.indexes.indexOf(shareIndex) < 0) receipts.indexes.push(shareIndex);

  // 4. No more public reads of the collection.
  receipts.viewRule = "customer = @request.auth.id || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')";
  app.save(receipts);
  console.log("[MIGRATION 1793000006] digital_receipts is no longer publicly readable");
}, (app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    receipts.indexes = (receipts.indexes || []).filter(function (index) {
      return index.indexOf("idx_receipt_share_token") < 0;
    });
    try { receipts.fields.removeByName("share_token"); } catch (fieldErr) {}
    receipts.viewRule = "";
    app.save(receipts);
  } catch (err) {}
});
