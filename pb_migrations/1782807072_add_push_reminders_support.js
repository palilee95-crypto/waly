/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const subCol = app.findCollectionByNameOrId("push_subscriptions");

    // Make user field optional so guest/customer bookers can subscribe with phone
    const userField = subCol.fields.getByName("user");
    if (userField) {
      userField.required = false;
    }

    // Add customer_phone text field if not exists
    if (!subCol.fields.getByName("customer_phone")) {
      subCol.fields.add(new Field({
        "hidden": false,
        "id": "text_cphone_ps",
        "name": "customer_phone",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }));
    }

    app.save(subCol);
    console.log("[MIGRATION 1782807072] Updated push_subscriptions collection with customer_phone support");
  } catch (err) {
    console.log("[MIGRATION 1782807072] push_subscriptions error:", err);
  }

  try {
    const bkgCol = app.findCollectionByNameOrId("service_bookings");

    // Add reminders_sent json field to track sent push reminders (12h, 3h, 30m)
    if (!bkgCol.fields.getByName("reminders_sent")) {
      bkgCol.fields.add(new Field({
        "hidden": false,
        "id": "json_reminders_bkg",
        "name": "reminders_sent",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "json"
      }));
    }

    app.save(bkgCol);
    console.log("[MIGRATION 1782807072] Updated service_bookings with reminders_sent JSON field");
  } catch (err) {
    console.log("[MIGRATION 1782807072] service_bookings error:", err);
  }
}, (app) => {
  try {
    const subCol = app.findCollectionByNameOrId("push_subscriptions");
    subCol.fields.removeById("text_cphone_ps");
    app.save(subCol);
  } catch (err) {}

  try {
    const bkgCol = app.findCollectionByNameOrId("service_bookings");
    bkgCol.fields.removeById("json_reminders_bkg");
    app.save(bkgCol);
  } catch (err) {}
});
