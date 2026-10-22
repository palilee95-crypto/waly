/// <reference path="../pb_data/types.d.ts" />
// A manual POS claim created through the booking-scoped plan bypass must stay
// tied to that booking. Without the link, one active booking id could open
// unlimited exemption claims and complete them as ordinary sales.
migrate((app) => {
  try {
    const claims = app.findCollectionByNameOrId("nfc_claims");
    const bookings = app.findCollectionByNameOrId("service_bookings");

    let exists = false;
    try {
      exists = !!claims.fields.getByName("booking");
    } catch (fieldErr) {
      exists = false;
    }
    if (!exists) {
      claims.fields.add(new Field({
        id: "rel_nfc_booking",
        name: "booking",
        type: "relation",
        required: false,
        presentable: false,
        collectionId: bookings.id,
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      }));
      app.save(claims);
      console.log("[MIGRATION 1793000008] Added nfc_claims.booking");
    }

    // Index in a second save: PocketBase builds indexes before new columns when
    // both are saved together, and an index over a missing column aborts boot.
    claims.indexes = claims.indexes || [];
    const index = "CREATE INDEX IF NOT EXISTS idx_nfc_claims_booking ON nfc_claims(booking) WHERE booking != ''";
    if (claims.indexes.indexOf(index) < 0) {
      claims.indexes.push(index);
      app.save(claims);
      console.log("[MIGRATION 1793000008] Indexed nfc_claims.booking");
    }
  } catch (err) {
    // A quiet skip would silently disable the booking binding, so fail loudly.
    console.log("[MIGRATION 1793000008 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const claims = app.findCollectionByNameOrId("nfc_claims");
    claims.indexes = (claims.indexes || []).filter((idx) => idx.indexOf("idx_nfc_claims_booking") < 0);
    try {
      claims.fields.removeByName("booking");
    } catch (fieldErr) {}
    app.save(claims);
  } catch (err) {}
});
