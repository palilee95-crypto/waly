/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_services");
    if (!collection.fields.getByName("assigned_staff")) {
      collection.fields.add(new Field({
        "id": "json_assigned_stf",
        "name": "assigned_staff",
        "type": "json",
        "system": false,
        "required": false
      }));
      return app.save(collection);
    }
  } catch (err) {
    console.log("Migration error (assigned_staff):", err.message || err);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_services");
    collection.fields.removeByName("assigned_staff");
    return app.save(collection);
  } catch (err) {}
});
