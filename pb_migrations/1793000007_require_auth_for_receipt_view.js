/// <reference path="../pb_data/types.d.ts" />
// `customer = @request.auth.id` also matches when BOTH sides are empty: an
// unauthenticated request has no auth id, and a receipt written for a shadow
// customer (or before the customer was linked) has an empty `customer`. Those
// receipts were therefore readable by anyone who had the record id.
//
// Require a session first, then apply the ownership checks.
migrate((app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    receipts.viewRule = "@request.auth.id != '' && (customer = @request.auth.id || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != ''))";
    app.save(receipts);
    console.log("[MIGRATION 1793000007] digital_receipts.viewRule now requires a session");
  } catch (err) {
    console.log("[MIGRATION 1793000007 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    receipts.viewRule = "customer = @request.auth.id || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')";
    app.save(receipts);
  } catch (err) {}
});
