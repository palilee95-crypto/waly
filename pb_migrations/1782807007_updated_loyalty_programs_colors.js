/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("loyalty_programs")

  // add stamp_color field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "text_stamp_color",
    "name": "stamp_color",
    "pattern": "^#[0-9A-Fa-f]{6}$",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add font_color field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "text_font_color",
    "name": "font_color",
    "pattern": "^#[0-9A-Fa-f]{6}$",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("loyalty_programs")

  collection.fields.removeById("text_stamp_color")
  collection.fields.removeById("text_font_color")

  return app.save(collection)
})
