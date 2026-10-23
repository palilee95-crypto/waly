/// <reference path="../pb_data/types.d.ts" />
// The ledger route counts receipts per transaction to decide whether the
// Receipt action is offered. Without an index that is a full scan of
// digital_receipts for every row; `transaction` is a reserved word in SQLite,
// so the column must stay quoted.
migrate((app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    receipts.indexes = receipts.indexes || [];
    const index = "CREATE INDEX IF NOT EXISTS idx_paid_receipts_transaction ON digital_receipts(\"transaction\") WHERE \"transaction\" != ''";
    if (receipts.indexes.indexOf(index) < 0) {
      receipts.indexes.push(index);
      app.save(receipts);
      console.log("[MIGRATION 1793000010] Indexed digital_receipts.transaction");
    }
  } catch (err) {
    console.log("[MIGRATION 1793000010 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    receipts.indexes = (receipts.indexes || []).filter(function (idx) {
      return idx.indexOf("idx_paid_receipts_transaction") < 0;
    });
    app.save(receipts);
  } catch (err) {
    console.log("[MIGRATION 1793000010 DOWN ERROR]", err.message || err);
  }
});
