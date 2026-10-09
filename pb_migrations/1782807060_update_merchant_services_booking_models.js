/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_services");

    // Update or add item_type with expanded values
    const itemTypeField = collection.fields.getByName("item_type");
    const allowedTypes = [
      "service",
      "automotive",
      "facility",
      "lodging",
      "dining",
      "catering",
      "class",
      "product",
      "addon"
    ];

    if (itemTypeField) {
      itemTypeField.values = allowedTypes;
    } else {
      collection.fields.add(new Field({
        "id": "sel_type_srv",
        "name": "item_type",
        "type": "select",
        "system": false,
        "required": false,
        "values": allowedTypes
      }));
    }

    // Add requires_staff (bool)
    if (!collection.fields.getByName("requires_staff")) {
      collection.fields.add(new Field({
        "id": "bool_req_staff_srv",
        "name": "requires_staff",
        "type": "bool",
        "system": false,
        "required": false
      }));
    }

    // Add total_units (number)
    if (!collection.fields.getByName("total_units")) {
      collection.fields.add(new Field({
        "id": "num_units_srv",
        "name": "total_units",
        "type": "number",
        "system": false,
        "required": false
      }));
    }

    // Add max_pax (number)
    if (!collection.fields.getByName("max_pax")) {
      collection.fields.add(new Field({
        "id": "num_pax_srv",
        "name": "max_pax",
        "type": "number",
        "system": false,
        "required": false
      }));
    }

    // Add peak_price (number)
    if (!collection.fields.getByName("peak_price")) {
      collection.fields.add(new Field({
        "id": "num_peak_price_srv",
        "name": "peak_price",
        "type": "number",
        "system": false,
        "required": false
      }));
    }

    // Add security_deposit (number)
    if (!collection.fields.getByName("security_deposit")) {
      collection.fields.add(new Field({
        "id": "num_deposit_srv",
        "name": "security_deposit",
        "type": "number",
        "system": false,
        "required": false
      }));
    }

    app.save(collection);
    console.log("[MIGRATION 1782807060] Successfully updated merchant_services with universal booking models");
  } catch (err) {
    console.log("Migration 1782807060 error:", err);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_services");
    collection.fields.removeById("bool_req_staff_srv");
    collection.fields.removeById("num_units_srv");
    collection.fields.removeById("num_pax_srv");
    collection.fields.removeById("num_peak_price_srv");
    collection.fields.removeById("num_deposit_srv");
    app.save(collection);
  } catch (err) {}
});
