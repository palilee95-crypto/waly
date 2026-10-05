/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_services");

    // Add image_url text field if not exists
    if (!collection.fields.getByName("image_url")) {
      collection.fields.add(new Field({
        "hidden": false,
        "id": "text_image_url_srv",
        "name": "image_url",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }));
    }

    // Add image file field if not exists
    if (!collection.fields.getByName("image")) {
      collection.fields.add(new Field({
        "hidden": false,
        "id": "file_image_srv",
        "maxSelect": 1,
        "maxSize": 5242880,
        "mimeTypes": [
          "image/jpeg",
          "image/png",
          "image/svg+xml",
          "image/gif",
          "image/webp"
        ],
        "name": "image",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      }));
    }

    app.save(collection);
  } catch (err) {
    console.log("Migration 1782807056 error:", err);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchant_services");
    collection.fields.removeById("text_image_url_srv");
    collection.fields.removeById("file_image_srv");
    app.save(collection);
  } catch (err) {}
});
