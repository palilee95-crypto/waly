/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("follow_up_sequences");

  const sendDays = collection.fields.getByName("send_after_days");
  if (sendDays) {
    sendDays.required = false;
  }

  const sendHours = collection.fields.getByName("send_after_hours");
  if (sendHours) {
    sendHours.required = false;
  }

  const sendMinutes = collection.fields.getByName("send_after_minutes");
  if (sendMinutes) {
    sendMinutes.required = false;
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("follow_up_sequences");

  const sendDays = collection.fields.getByName("send_after_days");
  if (sendDays) {
    sendDays.required = true;
  }

  const sendHours = collection.fields.getByName("send_after_hours");
  if (sendHours) {
    sendHours.required = true;
  }

  const sendMinutes = collection.fields.getByName("send_after_minutes");
  if (sendMinutes) {
    sendMinutes.required = true;
  }

  return app.save(collection);
})
