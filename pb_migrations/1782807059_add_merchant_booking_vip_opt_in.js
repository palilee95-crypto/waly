/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("merchants") || app.findCollectionByNameOrId("pbc_merchants00");
    if (!collection) return null;

    try {
      collection.fields.add(new Field({
        "id": "bool_bkvip_optin",
        "name": "booking_vip_opt_in",
        "type": "bool",
        "required": false
      }));
    } catch (e) {}

    try {
      collection.fields.add(new Field({
        "id": "text_bkvip_claim",
        "name": "booking_vip_claimed_at",
        "type": "text",
        "required": false
      }));
    } catch (e) {}

    app.save(collection);
  } catch (err) {
    console.log("[MIGRATION 1782807059] Error adding booking_vip fields:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
