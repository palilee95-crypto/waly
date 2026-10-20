/// <reference path="../pb_data/types.d.ts" />
// Adds "travel" to the merchants.category select so travel merchants get a real
// base bucket instead of being folded into "other". The precise type stays in
// merchants.metadata.sub_category (travel_agency | umrah_hajj | car_rental | attraction).
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("merchants");
    const field = col.fields.getByName("category");
    if (!field) {
      console.log("[MIGRATION 1792470580] merchants.category not found");
      return null;
    }
    const values = field.values || [];
    if (values.indexOf("travel") === -1) {
      field.values = values.concat(["travel"]);
      app.save(col);
      console.log("[MIGRATION 1792470580] Added travel to merchants.category");
    } else {
      console.log("[MIGRATION 1792470580] merchants.category already includes travel");
    }
  } catch (err) {
    console.log("[MIGRATION 1792470580] Error:", err.message || err);
  }
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("merchants");
    const field = col.fields.getByName("category");
    if (!field) return null;

    try {
      const records = app.findRecordsByFilter("merchants", "category = 'travel'", "", 0, 0);
      for (let i = 0; i < records.length; i++) {
        records[i].set("category", "other");
        app.save(records[i]);
      }
    } catch (e) {}

    const values = field.values || [];
    if (values.indexOf("travel") !== -1) {
      field.values = values.filter((v) => v !== "travel");
      app.save(col);
    }
  } catch (e) {}
  return null;
});
