/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // 1. Update rewards collection schema
    const rewardsCol = app.findCollectionByNameOrId("pbc_rewards000") || app.findCollectionByNameOrId("rewards");
    if (rewardsCol) {
      try {
        rewardsCol.fields.add(new Field({
          "id": "sel_disc_type_rw",
          "name": "discount_type",
          "type": "select",
          "required": false,
          "values": ["percentage", "fixed_amount", "none"]
        }));
      } catch (e) {}

      try {
        rewardsCol.fields.add(new Field({
          "id": "num_disc_val_rw",
          "name": "discount_value",
          "type": "number",
          "required": false
        }));
      } catch (e) {}

      try {
        rewardsCol.fields.add(new Field({
          "id": "num_min_spend_rw",
          "name": "min_spend",
          "type": "number",
          "required": false
        }));
      } catch (e) {}

      try {
        rewardsCol.fields.add(new Field({
          "id": "num_max_disc_rw",
          "name": "max_discount",
          "type": "number",
          "required": false
        }));
      } catch (e) {}

      try {
        rewardsCol.fields.add(new Field({
          "id": "num_free_qty_rw",
          "name": "free_quantity",
          "type": "number",
          "required": false
        }));
      } catch (e) {}

      app.save(rewardsCol);
      console.log("[MIGRATION 1782807064] Successfully updated rewards schema with structured fields");
    }
  } catch (rErr) {
    console.log("[MIGRATION 1782807064] Error updating rewards schema:", rErr.message || rErr);
  }

  // 2. Create reward_eligible_items collection
  try {
    try {
      app.findCollectionByNameOrId("reward_eligible_items");
      console.log("Collection reward_eligible_items already exists, skipping creation");
      return null;
    } catch (e) { /* create below */ }

    let rewardsColId = "pbc_rewards000";
    try {
      const rCol = app.findCollectionByNameOrId("rewards") || app.findCollectionByNameOrId("pbc_rewards000");
      if (rCol) rewardsColId = rCol.id;
    } catch (rErr) {}

    let servicesColId = "merchant_services";
    try {
      const sCol = app.findCollectionByNameOrId("merchant_services");
      if (sCol) servicesColId = sCol.id;
    } catch (sErr) {}

    let merchantsColId = "pbc_merchants00";
    try {
      const mCol = app.findCollectionByNameOrId("merchants") || app.findCollectionByNameOrId("pbc_merchants00");
      if (mCol) merchantsColId = mCol.id;
    } catch (mErr) {}

    const collection = new Collection({
      "id": "pbc_rw_elg_itm",
      "name": "reward_eligible_items",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
      "createRule": "merchant.owner = @request.auth.id",
      "updateRule": "merchant.owner = @request.auth.id",
      "deleteRule": "merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text_id_rei", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
        { "id": "autodate_cr_rei", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_rei", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_reward_rei", "name": "reward", "type": "relation", "system": false, "required": true, "collectionId": rewardsColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "rel_item_rei", "name": "item", "type": "relation", "system": false, "required": true, "collectionId": servicesColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "rel_merchant_rei", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": merchantsColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_rw_item ON reward_eligible_items (reward, item)"
      ]
    });
    const saved = app.save(collection);
    console.log("[MIGRATION 1782807064] Successfully created reward_eligible_items collection");
    return saved;
  } catch (err) {
    console.log("[MIGRATION 1782807064] Error creating reward_eligible_items collection:", err.message || err);
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("reward_eligible_items");
    if (col) app.delete(col);
  } catch (err) {}
  return null;
});
