/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("merchants");

    try {
      col.fields.addAt(col.fields.length,
        new Field({
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
        })
      );
    } catch (e) {}

    try {
      col.fields.addAt(col.fields.length,
        new Field({
          "id": "text_onb_logo_url",
          "name": "onboarding_logo_url",
          "type": "text",
          "system": false,
          "required": false
        })
      );
    } catch (e) {}

    try {
      col.fields.addAt(col.fields.length,
        new Field({
          "id": "text_onb_bg_url",
          "name": "onboarding_bg_url",
          "type": "text",
          "system": false,
          "required": false
        })
      );
    } catch (e) {}

    return app.save(col);
  } catch (err) {
    console.log("Skip background image migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  return null;
})
