/// <reference path="../pb_data/types.d.ts" />
// 1793000015 tried to make birthday_logs server-only with `null`, but the Goja
// binding turns that into "" (public) instead of a nil rule. Databases that ran
// 0015 before this fix still accept client writes to birthday_logs. Re-apply
// the lock with an always-false rule; hooks are unaffected.
migrate((app) => {
  try {
    const logs = app.findCollectionByNameOrId("birthday_logs");
    const serverOnly = "@request.auth.id = '__server_only__'";
    logs.createRule = serverOnly;
    logs.updateRule = serverOnly;
    logs.deleteRule = serverOnly;
    app.save(logs);
    console.log("[MIGRATION 1793000016] Locked birthday_logs writes (server-only)");
  } catch (err) {
    console.log("[MIGRATION 1793000016 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const logs = app.findCollectionByNameOrId("birthday_logs");
    logs.createRule = "";
    logs.updateRule = "";
    logs.deleteRule = "";
    app.save(logs);
  } catch (err) {
    console.log("[MIGRATION 1793000016 DOWN ERROR]", err.message || err);
  }
});
