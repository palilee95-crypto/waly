/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("merchants")

  // add banner field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "file_merchant_banner",
    "maxSelect": 1,
    "maxSize": 5242880, // 5MB
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/svg+xml",
      "image/gif",
      "image/webp"
    ],
    "name": "banner",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("merchants")

  // remove field
  collection.fields.removeById("file_merchant_banner")

  return app.save(collection)
})
