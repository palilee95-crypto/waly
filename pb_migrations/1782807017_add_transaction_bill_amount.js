/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("transactions")

  // add bill_amount field
  collection.fields.addAt(9, new Field({
    "help": "",
    "hidden": false,
    "id": "num_txn_bill_amount",
    "name": "bill_amount",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "min": 0,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("transactions")

  // remove field
  collection.fields.removeById("num_txn_bill_amount")

  return app.save(collection)
})
