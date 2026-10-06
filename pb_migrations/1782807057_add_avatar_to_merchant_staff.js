/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_staff");

    // Add avatar file field if not exists
    if (!collection.fields.getByName("avatar")) {
      collection.fields.add(new Field({
        "hidden": false,
        "id": "file_avatar_mstf",
        "maxSelect": 1,
        "maxSize": 5242880,
        "mimeTypes": [
          "image/jpeg",
          "image/png",
          "image/webp"
        ],
        "name": "avatar",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      }));
    }

    app.save(collection);
    console.log("[MIGRATION 1782807057] Successfully added avatar field to merchant_staff");
  } catch (err) {
    console.log("Migration 1782807057 error:", err);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_staff");
    collection.fields.removeById("file_avatar_mstf");
    app.save(collection);
  } catch (err) {}
});
