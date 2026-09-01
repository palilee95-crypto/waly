/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("transactions");
  collection.deleteRule = "merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')";
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("transactions");
  collection.deleteRule = null;
  return app.save(collection);
});
