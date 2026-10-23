/// <reference path="../pb_data/types.d.ts" />
// `1793000006` added `digital_receipts.share_token` and backfilled the rows that
// existed then, but every later writer still had to set it itself — and prod's
// `booking_helper.js` was stale (10.21), so booking receipts were written with an
// empty token. A receipt is only reachable through its token, so those slips were
// unreachable from the customer screen and "tap to retry" could never succeed.
//
// The hooks now set it (and `/api/risev/nfc/receipt` mints one on read); this
// migration closes the gap for rows already written.
migrate((app) => {
  try {
    const records = app.findAllRecords("digital_receipts");
    let fixed = 0;
    for (let i = 0; i < records.length; i++) {
      const receipt = records[i];
      if (receipt.getString("share_token")) continue;
      receipt.set("share_token", $security.randomString(24));
      app.save(receipt);
      fixed++;
    }
    console.log("[MIGRATION 1793000012] Backfilled share_token on " + fixed + " receipt(s)");
  } catch (err) {
    console.log("[MIGRATION 1793000012 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  // Reverting would make every receipt unlinkable, so the down migration is a no-op.
  console.log("[MIGRATION 1793000012 DOWN] No-op: removing share tokens would break receipt links.");
});
