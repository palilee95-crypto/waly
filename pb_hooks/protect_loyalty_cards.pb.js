// pb_hooks/protect_loyalty_cards.pb.js
//
// loyalty_cards.updateRule lets the owning customer PATCH their own card, so the
// record fields that drive loyalty economics must be guarded here.
//
// This is a REQUEST hook (`onRecordUpdateRequest`) rather than `onRecordUpdate`:
// the record hook's `e.httpContext.get("authRecord")` returns nothing for API
// requests in this JSVM, which made the whole guard a no-op — a customer could set
// their own `points_balance` (verified: PATCH 99999 returned 200). Request hooks
// expose `e.auth` directly, and server-side `$app.save(card)` from the points hooks
// does not go through them.
onRecordUpdateRequest((e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    // Superuser API requests (admin portal, hooks) are permitted.
    return e.next();
  }

  const isSuperuser =
    authRecord.isSuperuser === true ||
    (authRecord.collection && authRecord.collection().name === "_superusers") ||
    (authRecord.getString && authRecord.getString("role") === "admin");

  if (isSuperuser) {
    return e.next();
  }

  const cardMerchantId = e.record.get("merchant");
  const authMerchantId = authRecord.getString ? authRecord.getString("merchant_id") : "";
  const isCardOwnerMerchant = authMerchantId && cardMerchantId === authMerchantId;

  if (!isCardOwnerMerchant) {
    // Customers and non-owner merchants may only change non-financial fields
    // (e.g. opt_in_marketing).
    const original = e.record.original();
    const criticalFields = [
      "stamps_collected",
      "completions",
      "program",
      "customer",
      "merchant",
      "status",
      "points_balance",
      "last_activity",
    ];

    for (let i = 0; i < criticalFields.length; i++) {
      const field = criticalFields[i];
      if (e.record.get(field) !== original.get(field)) {
        throw new ForbiddenError(
          "You are not authorized to modify critical loyalty card fields: " + field
        );
      }
    }
  }

  return e.next();
}, "loyalty_cards");
