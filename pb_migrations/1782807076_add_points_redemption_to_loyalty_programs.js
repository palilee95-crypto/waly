/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_programs00") || app.findCollectionByNameOrId("loyalty_programs");
    if (!collection) return null;

    try {
      collection.fields.add(new Field({
        "id": "num_points_per_rm_lp",
        "name": "points_per_rm",
        "type": "number",
        "min": 1,
        "required": false
      }));
    } catch (e) {}

    try {
      collection.fields.add(new Field({
        "id": "num_min_redeem_pts_lp",
        "name": "min_redeem_points",
        "type": "number",
        "min": 0,
        "required": false
      }));
    } catch (e) {}

    try {
      collection.fields.add(new Field({
        "id": "num_max_redeem_pct_lp",
        "name": "max_redeem_percent",
        "type": "number",
        "min": 0,
        "max": 100,
        "required": false
      }));
    } catch (e) {}

    app.save(collection);

    // Backfill existing loyalty programs
    try {
      const records = app.findRecordsByFilter(collection.name || "loyalty_programs", "1=1", "created", 1000, 0);
      records.forEach((record) => {
        let changed = false;
        if (!record.get("points_per_rm") || Number(record.get("points_per_rm")) <= 0) {
          record.set("points_per_rm", 100);
          changed = true;
        }
        if (record.get("min_redeem_points") === null || record.get("min_redeem_points") === undefined) {
          record.set("min_redeem_points", 0);
          changed = true;
        }
        if (record.get("max_redeem_percent") === null || record.get("max_redeem_percent") === undefined) {
          record.set("max_redeem_percent", 0);
          changed = true;
        }
        if (changed) {
          app.save(record);
        }
      });
    } catch (bErr) {
      console.log("[MIGRATION 1782807076] Backfill note:", bErr.message || bErr);
    }
  } catch (err) {
    console.log("[MIGRATION 1782807076] Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
