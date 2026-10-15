/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_programs00") || app.findCollectionByNameOrId("loyalty_programs");
    if (!collection) return null;

    try {
      collection.fields.add(new Field({
        "id": "json_sub_rewards_lp",
        "name": "sub_rewards",
        "type": "json",
        "required": false
      }));
    } catch (e) {}

    app.save(collection);

    // Backfill existing records with empty array if empty
    try {
      const records = app.findRecordsByFilter(collection.name || "loyalty_programs", "1=1", "created", 1000, 0);
      records.forEach((record) => {
        if (!record.get("sub_rewards")) {
          record.set("sub_rewards", "[]");
          app.save(record);
        }
      });
    } catch (bErr) {
      console.log("[MIGRATION 1782807078] Backfill note:", bErr.message || bErr);
    }
  } catch (err) {
    console.log("[MIGRATION 1782807078] Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
