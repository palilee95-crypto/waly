/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("branches");
    console.log("Collection branches already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    const collection = new Collection({
      "id": "pbc_branches0000",
      "name": "branches",
      "type": "base",
      "system": false,
      "listRule": "",
      "viewRule": "",
      "createRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
      "updateRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
      "deleteRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
      "options": {},
      "fields": [
        { "id": "text_id_br", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
        { "id": "autodate_cr_br", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_br", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_merchant_br", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": "pbc_merchants00", "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "text_name_br", "name": "name", "type": "text", "system": false, "required": true },
        { "id": "text_address_br", "name": "address", "type": "text", "system": false, "required": false },
        { "id": "text_city_br", "name": "city", "type": "text", "system": false, "required": false },
        { "id": "text_phone_br", "name": "phone", "type": "text", "system": false, "required": false },
        { "id": "text_mname_br", "name": "manager_name", "type": "text", "system": false, "required": false },
        { "id": "bool_ishq_br", "name": "is_hq", "type": "bool", "system": false, "required": false },
        { "id": "sel_status_br", "name": "status", "type": "select", "system": false, "required": true, "presentable": false, "values": ["active", "inactive"] }
      ]
    });
    return app.save(collection);
  } catch (err) {
    console.log("Skip branches migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    return app.delete(col);
  } catch (err) {
    return null;
  }
})
