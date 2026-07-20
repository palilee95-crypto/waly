/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("qr_transactions");
    console.log("Collection qr_transactions already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    const collection = new Collection({
      "id": "pbc_qr_txns",
      "name": "qr_transactions",
      "type": "base",
      "system": false,
      "listRule": "merchant.owner = @request.auth.id",
      "viewRule": "merchant.owner = @request.auth.id || customer = @request.auth.id",
      "createRule": "merchant.owner = @request.auth.id",
      "updateRule": "",
      "deleteRule": "merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text_id_qr", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate_cr_qr", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_qr", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_merchant_qr", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": "pbc_merchants00", "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "rel_customer_qr", "name": "customer", "type": "relation", "system": false, "required": false, "collectionId": "_pb_users_auth_", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "num_bill_qr", "name": "bill_amount", "type": "number", "system": false, "required": true, "min": 0 },
        { "id": "num_stamps_qr", "name": "stamp_amount", "type": "number", "system": false, "required": true, "min": 1 },
        { "id": "text_txcode_qr", "name": "tx_code", "type": "text", "system": false, "required": true },
        { "id": "sel_status_qr", "name": "status", "type": "select", "system": false, "required": true, "presentable": false, "values": ["pending", "sent", "completed", "expired"] },
        { "id": "text_cphone_qr", "name": "customer_phone", "type": "text", "system": false, "required": false },
        { "id": "text_wsid_qr", "name": "whatsapp_message_sid", "type": "text", "system": false, "required": false },
        { "id": "date_comp_qr", "name": "completed_at", "type": "date", "system": false, "required": false }
      ]
    });
    return app.save(collection);
  } catch (err) {
    console.log("Skip qr_transactions migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  return null;
})