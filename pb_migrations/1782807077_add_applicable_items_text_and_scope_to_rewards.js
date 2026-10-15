/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const rewardsCol = app.findCollectionByNameOrId("pbc_rewards000") || app.findCollectionByNameOrId("rewards");
    if (rewardsCol) {
      try {
        rewardsCol.fields.add(new Field({
          "id": "txt_app_items_txt_rw",
          "name": "applicable_items_text",
          "type": "text",
          "required": false
        }));
      } catch (e) {}

      try {
        rewardsCol.fields.add(new Field({
          "id": "sel_disc_scope_rw",
          "name": "discount_scope",
          "type": "select",
          "required": false,
          "values": ["all", "specific"]
        }));
      } catch (e) {}

      app.save(rewardsCol);
      console.log("[MIGRATION 1782807077] Successfully added applicable_items_text and discount_scope fields to rewards schema");

      // Backfill existing rewards
      try {
        const records = app.findRecordsByFilter(rewardsCol.name || "rewards", "id != ''", "-created", 1000, 0);
        for (const record of records) {
          let updated = false;
          if (!record.get("discount_scope")) {
            record.set("discount_scope", "all");
            updated = true;
          }
          if (record.get("applicable_items_text") === null || record.get("applicable_items_text") === undefined) {
            record.set("applicable_items_text", "");
            updated = true;
          }
          if (updated) {
            app.save(record);
          }
        }
      } catch (bfErr) {
        console.log("[MIGRATION 1782807077] Backfill note:", bfErr.message || bfErr);
      }
    }
  } catch (err) {
    console.log("[MIGRATION 1782807077] Error adding applicable_items_text & discount_scope fields:", err.message || err);
  }
}, (app) => {
  try {
    const rewardsCol = app.findCollectionByNameOrId("pbc_rewards000") || app.findCollectionByNameOrId("rewards");
    if (rewardsCol) {
      try {
        rewardsCol.fields.removeById("txt_app_items_txt_rw");
        rewardsCol.fields.removeById("sel_disc_scope_rw");
        app.save(rewardsCol);
      } catch (e) {}
    }
  } catch (err) {}
});
