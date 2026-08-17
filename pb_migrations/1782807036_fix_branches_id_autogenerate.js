/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    const idField = col.fields.getByName("id");
    if (idField) {
      idField.autogeneratePattern = "[a-z0-9]{15}";
      idField.pattern = "^[a-z0-9]+$";
      idField.min = 15;
      idField.max = 15;
    }
    app.save(col);
    console.log("Successfully fixed branches collection ID autogenerate pattern");
  } catch (err) {
    console.log("Skip fix branches ID autogenerate: " + (err.message || err));
  }
  return null;
}, (app) => {
  return null;
});
