/// <reference path="../pb_data/types.d.ts" />
// Keep the paid receipt as a server-owned snapshot of the completed transaction.
//
// The columns are saved BEFORE the unique index is added: PocketBase builds a
// collection's indexes in the same save as its fields, and an index over a
// column that does not exist yet aborts the whole migration (and with it the
// boot). Two saves keeps the column and the index in the right order.
migrate((app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    const claims = app.findCollectionByNameOrId("nfc_claims");
    const transactions = app.findCollectionByNameOrId("transactions");
    const fields = [
      { id: "rel_paid_claim", name: "claim", type: "relation", collectionId: claims.id, cascadeDelete: false, minSelect: 0, maxSelect: 1 },
      { id: "rel_paid_txn", name: "transaction", type: "relation", collectionId: transactions.id, cascadeDelete: false, minSelect: 0, maxSelect: 1 },
      { id: "num_paid_subtotal", name: "subtotal", type: "number" },
      { id: "num_paid_discount", name: "discount_amount", type: "number" },
      { id: "text_paid_status", name: "payment_status", type: "text" },
      { id: "text_paid_ref", name: "payment_reference", type: "text" },
      { id: "text_paid_customer", name: "customer_name", type: "text" },
      { id: "text_paid_staff", name: "staff_name", type: "text" },
      { id: "text_paid_branch", name: "branch_name", type: "text" },
    ];

    let addedField = false;
    for (const field of fields) {
      let exists = false;
      try { exists = !!receipts.fields.getByName(field.name); } catch (err) { exists = false; }
      if (!exists) {
        receipts.fields.add(new Field({ system: false, required: false, presentable: false, ...field }));
        addedField = true;
      }
    }
    if (addedField) {
      app.save(receipts);
      console.log("[MIGRATION 1793000004] Added paid-receipt columns to digital_receipts");
    }

    receipts.indexes = receipts.indexes || [];
    const claimIndex = "CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_receipts_claim ON digital_receipts(claim) WHERE claim != ''";
    if (receipts.indexes.indexOf(claimIndex) < 0) receipts.indexes.push(claimIndex);

    // API clients must not be able to fabricate or alter a PAID receipt. Hooks
    // continue to write these records with server privileges.
    receipts.createRule = null;
    receipts.updateRule = null;
    receipts.deleteRule = null;
    app.save(receipts);
    console.log("[MIGRATION 1793000004] digital_receipts is server-owned (one paid receipt per claim)");
  } catch (err) {
    console.log("[MIGRATION 1793000004 ERROR]", err.message || err);
  }
}, (app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    receipts.indexes = (receipts.indexes || []).filter((index) => index.indexOf("idx_paid_receipts_claim") < 0);
    for (const name of ["claim", "transaction", "subtotal", "discount_amount", "payment_status", "payment_reference", "customer_name", "staff_name", "branch_name"]) {
      try { receipts.fields.removeByName(name); } catch (err) {}
    }
    receipts.createRule = "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)";
    receipts.updateRule = receipts.createRule;
    receipts.deleteRule = receipts.createRule;
    app.save(receipts);
  } catch (err) {}
});
