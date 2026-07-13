// pb_hooks/protect_loyalty_cards.pb.js

onRecordUpdate((e) => {
  const authRecord = e.httpContext ? e.httpContext.get("authRecord") : null;
  if (!authRecord) {
    // System/cron updates are permitted
    return e.next();
  }

  // Check if user is a merchant or admin
  const isMerchant = authRecord.get("role") === "merchant" || authRecord.get("role") === "both";

  if (!isMerchant) {
    // Customers can only update opt_in_marketing. Let's compare all other fields with original values.
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
