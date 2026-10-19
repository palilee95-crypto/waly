/// <reference path="../pb_data/types.d.ts" />
// `manual_pos` marks a claim opened from the merchant's POS button rather than
// a customer tap. It lets the dashboard keep POS sales out of the "pending
// stamp requests" list and lets the claim survive a reload with its flag.
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("nfc_claims");
    let has = false;
    try {
      if (col.fields.getByName("manual_pos")) has = true;
    } catch (e) {}
    if (!has) {
      col.fields.add(new Field({
        id: "bool_manual_pos_nfc",
        name: "manual_pos",
        type: "bool",
        system: false,
        required: false,
        presentable: false,
      }));
      app.save(col);
      console.log("[MIGRATION 1782807094] Added nfc_claims.manual_pos");
    } else {
      console.log("[MIGRATION 1782807094] nfc_claims.manual_pos already exists");
    }
  } catch (err) {
    console.log("[MIGRATION 1782807094] nfc_claims.manual_pos:", err.message || err);
  }
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("nfc_claims");
    col.fields.removeByName("manual_pos");
    app.save(col);
  } catch (e) {}
  return null;
});
