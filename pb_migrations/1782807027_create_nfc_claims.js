/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("nfc_claims");
    console.log("Collection nfc_claims already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    const collection = new Collection({
      "id": "pbc_nfc_claims",
      "name": "nfc_claims",
      "type": "base",
      "system": false,
      "listRule": "",
      "viewRule": "",
      "createRule": "",
      "updateRule": "",
      "deleteRule": "merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text_id_nfc", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate_cr_nfc", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_nfc", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_merchant_nfc", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": "pbc_merchants00", "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "rel_customer_nfc", "name": "customer", "type": "relation", "system": false, "required": false, "collectionId": "_pb_users_auth_", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "text_cname_nfc", "name": "customer_name", "type": "text", "system": false, "required": true },
        { "id": "text_cphone_nfc", "name": "customer_phone", "type": "text", "system": false, "required": true },
        { "id": "num_bill_nfc", "name": "bill_amount", "type": "number", "system": false, "required": false, "min": 0 },
        { "id": "num_stamps_nfc", "name": "stamp_amount", "type": "number", "system": false, "required": false, "min": 0 },
        { "id": "text_scode_nfc", "name": "session_code", "type": "text", "system": false, "required": true },
        { "id": "sel_status_nfc", "name": "status", "type": "select", "system": false, "required": true, "presentable": false, "values": ["pending", "completed", "cancelled"] },
        { "id": "date_comp_nfc", "name": "completed_at", "type": "date", "system": false, "required": false }
      ]
    });
    return app.save(collection);
  } catch (err) {
    console.log("Skip nfc_claims migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  return null;
})
