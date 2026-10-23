/// <reference path="../pb_data/types.d.ts" />
// A voucher can cover the whole bill, and that is still a completed sale whose
// receipt must read RM0.00. PocketBase treats 0 as blank on a `required` number
// field ("total_amount: Cannot be blank."), so every voucher-only receipt failed
// to save while the stamp was already credited. The writer always sets the
// field; optional simply lets 0 through.
migrate((app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    const total = receipts.fields.getByName("total_amount");
    if (total && total.required) {
      total.required = false;
      app.save(receipts);
      console.log("[MIGRATION 1793000009] digital_receipts.total_amount accepts 0");
    }
  } catch (err) {
    console.log("[MIGRATION 1793000009 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    // Re-saving the collection does not re-validate rows, so the rollback
    // "succeeds" while every RM0 receipt it created becomes unsavable.
    const zero = app.findRecordsByFilter("digital_receipts", "total_amount = 0", "-created", 1, 0);
    if (zero.length) {
      console.log("[MIGRATION 1793000009 DOWN] zero-total receipts exist; re-requiring total_amount makes them unsavable");
    }
    const total = receipts.fields.getByName("total_amount");
    if (total && !total.required) {
      total.required = true;
      app.save(receipts);
    }
  } catch (err) {
    console.log("[MIGRATION 1793000009 DOWN ERROR]", err.message || err);
  }
});
