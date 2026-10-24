/// <reference path="../pb_data/types.d.ts" />
// One-off cleanup: legacy NFC/quick claims embedded the applied voucher in the
// customer name (`Daadd [VOUCHER:id#title]`), and that name was copied into the
// customer record and carry-over claims. Strip the tag so every screen and
// message shows the real name.
migrate((app) => {
  const stripTag = (value) => String(value || "")
    .replace(/\s*\[\s*VOUCHER:[^\]]*\]\s*/gi, " ")
    .replace(/\s*[|·]\s*VOUCHER:.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  try {
    const users = app.findRecordsByFilter("users", "name ~ '[VOUCHER:'", "-created", 500, 0);
    let userCount = 0;
    users.forEach((u) => {
      const cleaned = stripTag(u.getString("name"));
      if (cleaned && cleaned !== u.getString("name")) {
        u.set("name", cleaned);
        app.save(u);
        userCount++;
      }
    });

    const claims = app.findRecordsByFilter("nfc_claims", "customer_name ~ '[VOUCHER:'", "-created", 500, 0);
    let claimCount = 0;
    claims.forEach((c) => {
      const cleaned = stripTag(c.getString("customer_name"));
      if (cleaned && cleaned !== c.getString("customer_name")) {
        c.set("customer_name", cleaned);
        app.save(c);
        claimCount++;
      }
    });

    console.log(`[MIGRATION 1793000017] Cleaned voucher tags: ${userCount} users, ${claimCount} claims`);
  } catch (err) {
    console.log("[MIGRATION 1793000017 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  // Non-destructive: the original tagged names are not restored.
});
