/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const merchants = app.findCollectionByNameOrId("merchants");
    if (!merchants) return null;

    let hasField = false;
    try {
      if (merchants.fields.getByName("inactive_threshold_days")) {
        hasField = true;
      }
    } catch (e) {}

    if (!hasField) {
      merchants.fields.add(new Field({
        "id": "num_inact_thresh",
        "name": "inactive_threshold_days",
        "type": "number",
        "system": false,
        "required": false,
        "presentable": false,
        "min": 1,
        "max": 365,
        "noDecimal": true
      }));
      app.save(merchants);
      console.log("[MIGRATION] Added inactive_threshold_days to merchants collection.");
    }
    return null;
  } catch (err) {
    console.log("[MIGRATION WARNING] Failed to add inactive_threshold_days:", err.message || err);
    return null;
  }
}, (app) => {
  try {
    const merchants = app.findCollectionByNameOrId("merchants");
    if (merchants) {
      merchants.fields.removeByName("inactive_threshold_days");
      app.save(merchants);
    }
  } catch (err) {}
  return null;
});
