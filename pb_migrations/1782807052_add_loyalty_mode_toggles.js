/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_programs00") || app.findCollectionByNameOrId("loyalty_programs");
    if (!collection) return null;

    try {
      collection.fields.add(new Field({
        "id": "bool_en_stamps_lp",
        "name": "enable_stamps",
        "type": "bool",
        "required": false
      }));
    } catch (e) {}

    try {
      collection.fields.add(new Field({
        "id": "bool_en_points_lp",
        "name": "enable_points",
        "type": "bool",
        "required": false
      }));
    } catch (e) {}

    app.save(collection);

    // Backfill existing loyalty programs to ensure enable_stamps = true and enable_points = true
    try {
      const records = app.findRecordsByFilter(collection.name || "loyalty_programs", "1=1", "created", 1000, 0);
      records.forEach((record) => {
        let changed = false;
        if (record.get("enable_stamps") === null || record.get("enable_stamps") === undefined) {
          record.set("enable_stamps", true);
          changed = true;
        }
        if (record.get("enable_points") === null || record.get("enable_points") === undefined) {
          record.set("enable_points", true);
          changed = true;
        }
        if (changed) {
          app.save(record);
        }
      });
    } catch (bErr) {
      console.log("[MIGRATION 1782807052] Backfill note:", bErr.message || bErr);
    }
  } catch (err) {
    console.log("[MIGRATION 1782807052] Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
