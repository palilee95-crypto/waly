/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("user_recommendation_cache");
    console.log("Collection user_recommendation_cache already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    let usersColId = "_pb_users_auth_";
    try {
      const uCol = app.findCollectionByNameOrId("users");
      if (uCol) usersColId = uCol.id;
    } catch (uErr) {}

    const collection = new Collection({
      "id": "pbc_rec_cache00",
      "name": "user_recommendation_cache",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != '' && customer = @request.auth.id",
      "viewRule": "@request.auth.id != '' && customer = @request.auth.id",
      "createRule": "@request.auth.id != ''",
      "updateRule": "@request.auth.id != '' && customer = @request.auth.id",
      "deleteRule": "@request.auth.id != '' && customer = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text_id_rc", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
        { "id": "autodate_cr_rc", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_rc", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_customer_rc", "name": "customer", "type": "relation", "system": false, "required": true, "collectionId": usersColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "json_recs_rc", "name": "recommended_merchants", "type": "json", "system": false, "required": true },
        { "id": "date_calc_rc", "name": "last_calculated", "type": "date", "system": false, "required": false }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_rec_cache_customer ON user_recommendation_cache (customer)"
      ]
    });
    const saved = app.save(collection);
    console.log("[MIGRATION 1782807061] Successfully created user_recommendation_cache collection");
    return saved;
  } catch (err) {
    console.log("[MIGRATION 1782807061] Skip user_recommendation_cache migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("user_recommendation_cache");
    return app.delete(col);
  } catch (err) {
    return null;
  }
});
