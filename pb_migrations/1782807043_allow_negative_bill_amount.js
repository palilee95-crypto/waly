/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("transactions");
  const field = collection.fields.getByName("bill_amount");
  if (field) {
    field.min = null;
  }
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("transactions");
  const field = collection.fields.getByName("bill_amount");
  if (field) {
    field.min = 0;
  }
  return app.save(collection);
});
