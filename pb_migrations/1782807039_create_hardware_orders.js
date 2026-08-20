/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("hardware_orders");
    console.log("Collection hardware_orders already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    const collection = new Collection({
      "name": "hardware_orders",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": "@request.auth.id != ''",
      "updateRule": "@request.auth.id != ''",
      "deleteRule": null,
      "options": {},
      "fields": [
        { "id": "text_id_hord", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
        { "id": "autodate_cr_hord", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_hord", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "text_ordno_hord", "name": "order_no", "type": "text", "system": false, "required": true },
        { "id": "rel_usr_hord", "name": "user", "type": "relation", "system": false, "required": false, "collectionId": "_pb_users_auth_", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1 },
        { "id": "rel_merch_hord", "name": "merchant", "type": "relation", "system": false, "required": false, "collectionId": "pbc_merchants00", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1 },
        { "id": "text_pkg_hord", "name": "package_title", "type": "text", "system": false, "required": true },
        { "id": "num_units_hord", "name": "units", "type": "number", "system": false, "required": false },
        { "id": "num_amt_hord", "name": "amount", "type": "number", "system": false, "required": false },
        { "id": "sel_paym_hord", "name": "payment_method", "type": "select", "system": false, "required": false, "values": ["fpx", "card", "whatsapp"] },
        { "id": "sel_pays_hord", "name": "payment_status", "type": "select", "system": false, "required": false, "values": ["pending", "paid", "refunded", "unpaid"] },
        { "id": "sel_fuls_hord", "name": "fulfillment_status", "type": "select", "system": false, "required": false, "values": ["pending", "processing", "shipped", "delivered", "cancelled"] },
        { "id": "text_recip_hord", "name": "recipient_name", "type": "text", "system": false, "required": true },
        { "id": "text_phone_hord", "name": "whatsapp_phone", "type": "text", "system": false, "required": true },
        { "id": "text_addr1_hord", "name": "address_line1", "type": "text", "system": false, "required": true },
        { "id": "text_addr2_hord", "name": "address_line2", "type": "text", "system": false, "required": false },
        { "id": "text_post_hord", "name": "postcode", "type": "text", "system": false, "required": true },
        { "id": "text_city_hord", "name": "city", "type": "text", "system": false, "required": true },
        { "id": "text_state_hord", "name": "state", "type": "text", "system": false, "required": true },
        { "id": "text_faddr_hord", "name": "full_address", "type": "text", "system": false, "required": false },
        { "id": "text_courier_hord", "name": "courier_name", "type": "text", "system": false, "required": false },
        { "id": "text_track_hord", "name": "tracking_number", "type": "text", "system": false, "required": false },
        { "id": "date_ship_hord", "name": "shipped_at", "type": "date", "system": false, "required": false },
        { "id": "text_notes_hord", "name": "notes", "type": "text", "system": false, "required": false }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX `idx_hord_ordno` ON `hardware_orders` (`order_no`)"
      ]
    });
    return app.save(collection);
  } catch (err) {
    console.log("Skip hardware_orders migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("hardware_orders");
    return app.delete(col);
  } catch (err) {
    return null;
  }
});
