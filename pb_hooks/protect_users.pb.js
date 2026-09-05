// pb_hooks/protect_users.pb.js
// Defense in Depth: Prevent non-admin users from escalating their own role, merchant_id, tier, points, or verification status.

onRecordUpdate((e) => {
  let authRecord = null;
  if (e.httpContext) {
    try { authRecord = e.httpContext.get("authRecord"); } catch (err) {}
  }
  if (!authRecord && e.auth) {
    authRecord = e.auth;
  }

  // System, hooks, and background operations bypass this check
  if (!authRecord) {
    return e.next();
  }

  const isSuperuser = (authRecord.isSuperuser === true) || 
                      (authRecord.collection && authRecord.collection().name === "_superusers") ||
                      (authRecord.getString && authRecord.getString("role") === "admin");

  if (!isSuperuser) {
    const original = e.record.original();
    if (!original) return e.next();

    // Sensitive fields that regular users are NOT permitted to change via direct API update
    const protectedFields = ["role", "merchant_id", "tier", "total_points", "verified"];

    for (let i = 0; i < protectedFields.length; i++) {
      const field = protectedFields[i];
      const origVal = original.get(field);
      const newVal = e.record.get(field);

      if (origVal !== newVal) {
        throw new ForbiddenError(`You are not authorized to modify the '${field}' field.`);
      }
    }
  }

  return e.next();
}, "users");
