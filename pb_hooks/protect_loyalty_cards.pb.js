// pb_hooks/protect_loyalty_cards.pb.js

onRecordUpdate((e) => {
  const authRecord = e.httpContext ? e.httpContext.get("authRecord") : null;
  if (!authRecord) {
    // System/cron updates are permitted
    return e.next();
  }

  // Check if user is a superuser
  const isSuperuser = (authRecord.isSuperuser === true) || 
                      (authRecord.collection && authRecord.collection().name === "_superusers") ||
                      (authRecord.getString && authRecord.getString("role") === "admin");

  if (isSuperuser) {
    return e.next();
  }

  const cardMerchantId = e.record.get("merchant");
  const authMerchantId = authRecord.getString ? authRecord.getString("merchant_id") : "";
  const isCardOwnerMerchant = authMerchantId && cardMerchantId === authMerchantId;

  if (!isCardOwnerMerchant) {
    // Customers and non-owner merchants can only update opt_in_marketing
    const original = e.record.original();
    const criticalFields = ["stamps_collected", "completions", "program", "customer", "merchant", "status"];
    
    for (let i = 0; i < criticalFields.length; i++) {
      const field = criticalFields[i];
      if (e.record.get(field) !== original.get(field)) {
        throw new ForbiddenError("You are not authorized to modify critical loyalty card fields: " + field);
      }
    }
  }

  return e.next();
}, "loyalty_cards");
