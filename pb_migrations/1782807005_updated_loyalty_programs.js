/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("loyalty_programs")

  // add card_background field
  collection.fields.addAt(14, new Field({
    "help": "",
    "hidden": false,
    "id": "file_card_bg",
    "maxSelect": 1,
    "maxSize": 5242880, // 5MB
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/svg+xml",
      "image/gif",
      "image/webp"
    ],
    "name": "card_background",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("loyalty_programs")

  // remove field
  collection.fields.removeById("file_card_bg")

  return app.save(collection)
})
