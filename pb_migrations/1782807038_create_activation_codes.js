/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Update subscriptions collection to allow 'stand_bundle' in plan field
  try {
    const subCol = app.findCollectionByNameOrId("subscriptions");
    const planField = subCol.fields.find((f) => f.name === "plan");
    if (planField && planField.values) {
      if (!planField.values.includes("stand_bundle")) {
        planField.values.push("stand_bundle");
      }
      if (!planField.values.includes("starter")) {
        planField.values.push("starter");
      }
      app.save(subCol);
    }
  } catch (subErr) {
    console.log("Subscriptions plan update skipped: " + (subErr.message || subErr));
  }

  // 2. Create activation_codes collection
  try {
    app.findCollectionByNameOrId("activation_codes");
    console.log("Collection activation_codes already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    const collection = new Collection({
      "name": "activation_codes",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "options": {},
      "fields": [
        { "id": "text_id_act", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
        { "id": "autodate_cr_act", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_act", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "text_code_act", "name": "code", "type": "text", "system": false, "required": true },
        { "id": "sel_plan_act", "name": "plan", "type": "select", "system": false, "required": true, "values": ["stand_bundle", "starter", "pro", "business"] },
        { "id": "num_quota_act", "name": "quota", "type": "number", "system": false, "required": false },
        { "id": "bool_isred_act", "name": "is_redeemed", "type": "bool", "system": false, "required": false },
        { "id": "rel_merch_act", "name": "redeemed_by", "type": "relation", "system": false, "required": false, "collectionId": "pbc_merchants00", "cascadeDelete": false, "minSelect": 0, "maxSelect": 1 },
        { "id": "date_red_act", "name": "redeemed_at", "type": "date", "system": false, "required": false },
        { "id": "sel_chan_act", "name": "channel", "type": "select", "system": false, "required": false, "values": ["tiktok_shop", "shopee", "marketplace", "manual"] }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX `idx_act_code` ON `activation_codes` (`code`)"
      ]
    });
    return app.save(collection);
  } catch (err) {
    console.log("Skip activation_codes migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("activation_codes");
    return app.delete(col);
  } catch (err) {
    return null;
  }
});
