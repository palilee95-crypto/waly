/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_merchants00") || app.findCollectionByNameOrId("merchants");
  if (!collection) return null;

  // Add background_image file field
  try {
    collection.fields.addAt(collection.fields.length, new Field({
      "help": "",
      "hidden": false,
      "id": "file_merchant_bg_img",
      "maxSelect": 1,
      "maxSize": 5242880, // 5MB
      "mimeTypes": [
        "image/jpeg",
        "image/png",
        "image/svg+xml",
        "image/gif",
        "image/webp"
      ],
      "name": "background_image",
      "presentable": false,
      "protected": false,
      "required": false,
      "system": false,
      "thumbs": [],
      "type": "file"
    }));
  } catch (e) {}

  // Add onboarding_logo_url text field
  try {
    collection.fields.addAt(collection.fields.length, new Field({
      "id": "text_onb_logo_url",
      "name": "onboarding_logo_url",
      "type": "text",
      "system": false,
      "required": false
    }));
  } catch (e) {}

  // Add onboarding_bg_url text field
  try {
    collection.fields.addAt(collection.fields.length, new Field({
      "id": "text_onb_bg_url",
      "name": "onboarding_bg_url",
      "type": "text",
      "system": false,
      "required": false
    }));
  } catch (e) {}

  return app.save(collection);
}, (app) => {
  return null;
});
