// pb_hooks/store_location_dedupe.pb.js
// Keep exactly ONE store_locations record per merchant.
//
// The client screens (profile-onboarding, edit-profile, (merchant)/_layout) all
// upsert with a check-then-create, but a stale read or a race can still insert a
// second row (SF Patners Store ended up with 5). This makes create idempotent on
// the server: if the merchant already has a location, fold the incoming values
// into it and short-circuit the insert.
//
// Only plain text/number fields are merged. `hours` (a JSON field) is deliberately
// NOT touched here: JSON fields read back as a byte array in this JSVM, so writing
// one back would corrupt it. The normal create path (no existing location) still
// stores hours correctly, and the client's update path handles later edits.

onRecordCreateRequest((e) => {
  const merchantId = e.record.get("merchant");
  if (!merchantId) return e.next();

  let existing = [];
  try {
    existing = $app.findRecordsByFilter("store_locations", `merchant = "${merchantId}"`, "-updated", 1, 0);
  } catch (lookupErr) {
    console.log("[STORE LOCATION DEDUPE] lookup error:", lookupErr.message || lookupErr);
    return e.next();
  }

  if (existing.length === 0) return e.next();

  const target = existing[0];

  // Only copy values that were actually supplied — never clobber with zero values.
  ["name", "address", "city", "country", "phone", "qr_code"].forEach(function (field) {
    const value = e.record.getString(field);
    if (value) target.set(field, value);
  });
  ["lat", "lng"].forEach(function (field) {
    const value = e.record.getFloat(field);
    if (value) target.set(field, value);
  });
  if (e.record.get("is_active") === true) target.set("is_active", true);

  try {
    $app.save(target);
  } catch (saveErr) {
    console.log("[STORE LOCATION DEDUPE] save error:", saveErr.message || saveErr);
    return e.next();
  }

  console.log("[STORE LOCATION DEDUPE] merged duplicate location for merchant " + merchantId + " into " + target.id);
  return e.json(200, target); // short-circuit: no new record is created
}, "store_locations");
