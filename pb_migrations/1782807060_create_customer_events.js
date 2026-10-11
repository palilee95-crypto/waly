/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("customer_events");
    console.log("Collection customer_events already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    let usersColId = "_pb_users_auth_";
    try {
      const uCol = app.findCollectionByNameOrId("users");
      if (uCol) usersColId = uCol.id;
    } catch (uErr) {}

    let merchantsColId = "pbc_merchants00";
    try {
      const mCol = app.findCollectionByNameOrId("merchants") || app.findCollectionByNameOrId("pbc_merchants00");
      if (mCol) merchantsColId = mCol.id;
    } catch (mErr) {}

    const collection = new Collection({
      "id": "pbc_cust_events",
      "name": "customer_events",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != '' && customer = @request.auth.id",
      "viewRule": "@request.auth.id != '' && customer = @request.auth.id",
      "createRule": "@request.auth.id != ''",
      "updateRule": null,
      "deleteRule": null,
      "options": {},
      "fields": [
        { "id": "text_id_ce", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
        { "id": "autodate_cr_ce", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_ce", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_customer_ce", "name": "customer", "type": "relation", "system": false, "required": true, "collectionId": usersColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "rel_merchant_ce", "name": "merchant", "type": "relation", "system": false, "required": false, "collectionId": merchantsColId, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "sel_type_ce", "name": "event_type", "type": "select", "system": false, "required": true, "values": [
            "merchant_viewed",
            "merchant_favorited",
            "merchant_unfavorited",
            "search_performed",
            "recommendation_impression",
            "recommendation_clicked",
            "booking_created",
            "booking_completed",
            "booking_cancelled",
            "visit_completed",
            "stamp_issued",
            "reward_redeemed"
        ]},
        { "id": "json_meta_ce", "name": "metadata", "type": "json", "system": false, "required": false },
        { "id": "text_source_ce", "name": "event_source", "type": "text", "system": false, "required": false },
        { "id": "text_session_ce", "name": "session_id", "type": "text", "system": false, "required": false }
      ],
      "indexes": [
        "CREATE INDEX idx_events_cust_type ON customer_events (customer, event_type, created)",
        "CREATE INDEX idx_events_merch_type ON customer_events (merchant, event_type, created)"
      ]
    });
    const saved = app.save(collection);
    console.log("[MIGRATION 1782807060] Successfully created customer_events collection");
    return saved;
  } catch (err) {
    console.log("[MIGRATION 1782807060] Skip customer_events migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("customer_events");
    return app.delete(col);
  } catch (err) {
    return null;
  }
});
