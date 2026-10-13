/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("pbc_programs00") || app.findCollectionByNameOrId("loyalty_programs");
    if (!collection) return null;

    try {
      collection.fields.add(new Field({
        "id": "num_min_spend_lp",
        "name": "min_spend_amount",
        "type": "number",
        "min": 0,
        "required": false
      }));
    } catch (e) {}

    app.save(collection);

    // Backfill existing loyalty programs to default 0
    try {
      const records = app.findRecordsByFilter(collection.name || "loyalty_programs", "1=1", "created", 1000, 0);
      records.forEach((record) => {
        const val = record.get("min_spend_amount");
        if (val === null || val === undefined) {
          record.set("min_spend_amount", 0);
          app.save(record);
        }
      });
    } catch (bErr) {
      console.log("[MIGRATION 1782807073] Backfill note:", bErr.message || bErr);
    }
  } catch (err) {
    console.log("[MIGRATION 1782807073] Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
