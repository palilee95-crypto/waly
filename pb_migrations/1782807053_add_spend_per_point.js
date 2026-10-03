/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_programs00") || app.findCollectionByNameOrId("loyalty_programs");
    if (!collection) return null;

    try {
      collection.fields.add(new Field({
        "id": "num_spend_per_point_lp",
        "name": "spend_per_point",
        "type": "number",
        "min": 0.1,
        "required": false
      }));
    } catch (e) {}

    app.save(collection);

    // Backfill existing loyalty programs to ensure spend_per_point defaults to 1.0
    try {
      const records = app.findRecordsByFilter(collection.name || "loyalty_programs", "1=1", "created", 1000, 0);
      records.forEach((record) => {
        const val = record.get("spend_per_point");
        if (val === null || val === undefined || Number(val) <= 0) {
          record.set("spend_per_point", 1.0);
          app.save(record);
        }
      });
    } catch (bErr) {
      console.log("[MIGRATION 1782807053] Backfill note:", bErr.message || bErr);
    }
  } catch (err) {
    console.log("[MIGRATION 1782807053] Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
