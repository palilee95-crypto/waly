/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")

  collection.fields.addAt(
    collection.fields.length - 2,
    new Field({
      "id": "date_birthday_user",
      "name": "birthday",
      "type": "date",
      "system": false,
      "required": true,
      "presentable": false,
      "onlyDate": true
    })
  )

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("_pb_users_auth_")
  collection.fields.removeById("date_birthday_user")
  return app.save(collection)
})