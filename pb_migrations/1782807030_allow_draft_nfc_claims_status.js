/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("nfc_claims");
    const statusField = collection.fields.find((f) => f.name === "status");
    if (statusField) {
      statusField.values = ["draft", "pending", "completed", "cancelled"];
      app.save(collection);
      console.log("Updated nfc_claims status select values to include draft");
    }
  } catch (err) {
    console.log("Skip nfc_claims status migration: " + (err.message || err));
  }
  return null;
}, (app) => {
  return null;
});
