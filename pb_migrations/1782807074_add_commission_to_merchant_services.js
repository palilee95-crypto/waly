/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_services");
    let changed = false;

    if (!collection.fields.getByName("commission_type")) {
      collection.fields.add(new Field({
        "id": "sel_comm_type_srv",
        "name": "commission_type",
        "type": "select",
        "system": false,
        "required": false,
        "values": ["none", "percentage", "fixed"]
      }));
      changed = true;
    }

    if (!collection.fields.getByName("commission_rate")) {
      collection.fields.add(new Field({
        "id": "num_comm_rate_srv",
        "name": "commission_rate",
        "type": "number",
        "system": false,
        "required": false
      }));
      changed = true;
    }

    if (changed) {
      return app.save(collection);
    }
  } catch (err) {
    console.log("Migration error (commission on merchant_services):", err.message || err);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_services");
    collection.fields.removeByName("commission_type");
    collection.fields.removeByName("commission_rate");
    return app.save(collection);
  } catch (err) {}
});
