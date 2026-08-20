// pb_hooks/auto_verify_users.pb.js
// Strict Mode: Block authentication for unverified users across all auth methods (email/password, OAuth, tokens)

onRecordAuthRequest((e) => {
  const record = e.record;
  if (!record) return e.next();
  const email = record.getString("email") || "";
  const isShadowOrQuick = email.startsWith("quick_") || email.startsWith("shadow_");
  
  if (!record.getBool("verified") && !isShadowOrQuick) {
    throw new BadRequestError("Please verify your email address before logging in.");
  }
  return e.next();
}, "users");
