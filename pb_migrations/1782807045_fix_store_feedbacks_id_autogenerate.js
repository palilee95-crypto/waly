/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("store_feedbacks");
    const idField = col.fields.getByName("id");
    if (idField) {
      idField.autogeneratePattern = "[a-z0-9]{15}";
      idField.pattern = "^[a-z0-9]+$";
      idField.min = 15;
      idField.max = 15;
    }
    app.save(col);
    console.log("Successfully fixed store_feedbacks collection ID autogenerate pattern");
  } catch (err) {
    console.log("Skip fix store_feedbacks ID autogenerate: " + (err.message || err));
  }
  return null;
}, (app) => {
  return null;
});
