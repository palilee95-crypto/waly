/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    const rule = "@request.auth.id != '' && (merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))";
    col.listRule = rule;
    col.viewRule = rule;
    app.save(col);
    console.log("[MIGRATION] branches listRule/viewRule tightened");
  } catch (err) {
    console.log("[MIGRATION] tighten branches rules:", err.message || err);
  }
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    col.listRule = "";
    col.viewRule = "";
    app.save(col);
  } catch (e) {}
  return null;
});
