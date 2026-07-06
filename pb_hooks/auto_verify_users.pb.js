onRecordAuthRequest((e) => {
  const record = e.record;
  if (record && !record.getBool("verified")) {
    record.set("verified", true);
    $app.save(record);
  }
  return e.next();
}, "users");
