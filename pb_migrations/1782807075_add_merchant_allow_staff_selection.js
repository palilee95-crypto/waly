/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchants") || app.findCollectionByNameOrId("pbc_merchants00");
    if (!collection) return null;

    try {
      collection.fields.add(new Field({
        "id": "bool_allow_staff_sel",
        "name": "allow_staff_selection",
        "type": "bool",
        "required": false
      }));
    } catch (e) {}

    app.save(collection);
    console.log("[MIGRATION 1782807075] Added allow_staff_selection to merchants collection");
  } catch (err) {
    console.log("[MIGRATION 1782807075] Error adding allow_staff_selection:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
