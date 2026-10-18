/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("subscriptions");
    col.createRule = null;
    col.updateRule = null;
    col.deleteRule = null;
    app.save(col);
    console.log("[MIGRATION] subscriptions write rules locked to superusers");
  } catch (err) {
    console.log("[MIGRATION] lock subscriptions:", err.message || err);
  }
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("subscriptions");
    col.createRule = "";
    col.updateRule = "";
    col.deleteRule = "";
    app.save(col);
  } catch (e) {}
  return null;
});
