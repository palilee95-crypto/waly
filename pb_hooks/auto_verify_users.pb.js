// pb_hooks/auto_verify_users.pb.js
// DISABLED: Emails are now verified via standard PocketBase verification links sent via Resend SMTP.
/*
onRecordAuthRequest((e) => {
  const record = e.record;
  if (record && !record.getBool("verified")) {
    record.set("verified", true);
    $app.save(record);
  }
  return e.next();
}, "users");
*/
