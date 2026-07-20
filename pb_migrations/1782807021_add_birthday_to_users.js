/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Add birthday field to existing users auth collection
  const users = app.findCollectionByNameOrId("users");

  users.fields.addAt(
    users.fields.length - 2, // insert before autodate updated
    new SchemaField({
      id: "date_birthday_user",
      name: "birthday",
      type: "date",
      system: false,
      required: true,
    })
  );

  return app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeById("date_birthday_user");
  return app.save(users);
});