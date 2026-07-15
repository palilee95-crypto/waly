/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("transactions");
  collection.createRule = "(@request.auth.role = 'merchant' || @request.auth.role = 'both')";
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("transactions");
  collection.createRule = "(@request.auth.role = 'merchant' || @request.auth.role = 'both') && @request.auth.merchant_id.status = 'active'";
  return app.save(collection);
})
