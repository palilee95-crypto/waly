/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pricing_settings");
  
  // Allow authenticated users (admin portal staff & merchants) to update and create pricing settings
  collection.listRule = "";
  collection.viewRule = "";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != ''";
  
  app.save(collection);
  console.log("[MIGRATION] Successfully unlocked updateRule and createRule on pricing_settings.");
}, (app) => {
  const collection = app.findCollectionByNameOrId("pricing_settings");
  if (collection) {
    collection.createRule = null;
    collection.updateRule = null;
    app.save(collection);
  }
});
