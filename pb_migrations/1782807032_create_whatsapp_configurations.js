/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("whatsapp_configurations");
    console.log("Collection whatsapp_configurations already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    const collection = new Collection({
      "id": "pbc_wa_configs",
      "name": "whatsapp_configurations",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != '' && merchant.owner = @request.auth.id",
      "viewRule": "@request.auth.id != '' && merchant.owner = @request.auth.id",
      "createRule": "@request.auth.id != '' && @request.auth.merchant_id = merchant.id",
      "updateRule": "@request.auth.id != '' && merchant.owner = @request.auth.id",
      "deleteRule": "@request.auth.id != '' && merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text_id_wac", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate_cr_wac", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_wac", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_merchant_wac", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": "pbc_merchants00", "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "text_waba_wac", "name": "waba_id", "type": "text", "system": false, "required": true },
        { "id": "text_phid_wac", "name": "phone_number_id", "type": "text", "system": false, "required": true },
        { "id": "text_token_wac", "name": "access_token", "type": "text", "system": false, "required": true },
        { "id": "text_phone_wac", "name": "phone_number", "type": "text", "system": false, "required": true },
        { "id": "sel_status_wac", "name": "status", "type": "select", "system": false, "required": true, "presentable": false, "values": ["connected", "disconnected"] }
      ]
    });
    return app.save(collection);
  } catch (err) {
    console.log("Skip whatsapp_configurations migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("whatsapp_configurations");
    return app.delete(col);
  } catch (err) {
    return null;
  }
})
