/// <reference path="../pb_data/types.d.ts" />
// `service_bookings` never had a `metadata` column, so every
// `booking.set("metadata", …)` was silently dropped (the JSVM "unknown field"
// gotcha — the write just vanishes, no error). That killed two features:
//
//   - Staff ratings: /api/risev/booking/rate-staff writes
//     metadata.staff_rating / staff_id / staff_review, and the staff aggregate
//     reads them back. Both were no-ops, so rating_avg/rating_count were
//     always 0 and the merchant UI showed fabricated fallbacks.
//   - Commission payouts: /api/risev/merchant/staff/commission-payout sets
//     metadata.commission_payout_status on each booking. It returned success
//     while recording nothing.
//
// Add the JSON field so both flows persist.

migrate((app) => {
  try {
    const bookingsCol = app.findCollectionByNameOrId("service_bookings");
    if (!bookingsCol) {
      console.log("[MIGRATION 1782807090] service_bookings not found, skipping");
      return;
    }

    let hasMetadata = false;
    try {
      hasMetadata = !!bookingsCol.fields.getByName("metadata");
    } catch (e) {}

    if (!hasMetadata) {
      bookingsCol.fields.add(new Field({
        "id": "json_metadata_bkg",
        "name": "metadata",
        "type": "json",
        "required": false,
        "maxSize": 0
      }));
      app.save(bookingsCol);
      console.log("[MIGRATION 1782807090] Added service_bookings.metadata (json) — staff ratings and commission payouts now persist");
    } else {
      console.log("[MIGRATION 1782807090] service_bookings.metadata already exists, skipping");
    }
  } catch (err) {
    console.log("[MIGRATION 1782807090] Error adding service_bookings.metadata:", err.message || err);
  }
}, (app) => {
  try {
    const bookingsCol = app.findCollectionByNameOrId("service_bookings");
    if (bookingsCol) {
      try {
        bookingsCol.fields.removeById("json_metadata_bkg");
        app.save(bookingsCol);
      } catch (e) {}
    }
  } catch (err) {}
});
