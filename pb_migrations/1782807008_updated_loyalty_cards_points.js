/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("loyalty_cards")

  // add points_balance field
  collection.fields.addAt(5, new Field({
    "help": "",
    "hidden": false,
    "id": "num_points_bal",
    "name": "points_balance",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "min": 0,
    "type": "number"
  }))

  // add tier field
  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "sel_card_tier",
    "name": "tier",
    "presentable": false,
    "required": false,
    "system": false,
    "maxSelect": 1,
    "values": [
      "bronze",
      "silver",
      "gold",
      "platinum"
    ],
    "type": "select"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("loyalty_cards")

  // remove fields
  collection.fields.removeById("num_points_bal")
  collection.fields.removeById("sel_card_tier")

  return app.save(collection)
})
