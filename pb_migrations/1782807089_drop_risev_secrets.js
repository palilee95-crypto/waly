/// <reference path="../pb_data/types.d.ts" />
// Drop the private `_risev_secrets` table.
//
// It was created lazily by the now-retired J&T shipping hook
// (pb_hooks/jnt.pb.js) to stash the J&T API key, and nothing else reads or
// writes it (verified by grepping pb_hooks/ and pb_migrations/).

migrate((app) => {
  try {
    app.db().newQuery("DROP TABLE IF EXISTS _risev_secrets").execute();
    console.log("[MIGRATION] dropped _risev_secrets (retired J&T integration)");
  } catch (err) {
    console.log("[MIGRATION] _risev_secrets drop skipped: " + (err.message || err));
  }
}, (app) => {
  // no-op — the table was only ever a cache for the removed J&T API key
});
