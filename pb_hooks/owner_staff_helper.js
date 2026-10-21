// The owner works the chair too. `service_bookings.staff` is a relation to
// `merchant_staff`, so an owner without a staff row can never be picked as a
// provider on the booking page. This module guarantees that row exists.
//
// JSVM rule: callers must require() this module — file-level helpers are not
// visible inside hook handlers.

function findOwnerStaff($app, merchantId, ownerId) {
  try {
    const rows = $app.findRecordsByFilter(
      "merchant_staff",
      "merchant = '" + merchantId + "' && user = '" + ownerId + "'",
      "created",
      1,
      0
    );
    return rows && rows.length > 0 ? rows[0] : null;
  } catch (err) {
    return null;
  }
}

function ensureOwnerStaff($app, merchant) {
  if (!merchant) return null;
  const ownerId = merchant.getString("owner") || "";
  if (!ownerId) return null;

  const existing = findOwnerStaff($app, merchant.id, ownerId);
  if (existing) return existing;

  let owner = null;
  try {
    owner = $app.findRecordById("users", ownerId);
  } catch (err) {
    return null;
  }

  const name = (owner.getString("name") || "").trim() || "Owner";

  let branchId = "";
  try {
    const hq = $app.findRecordsByFilter(
      "branches",
      "merchant = '" + merchant.id + "' && is_hq = true",
      "-created",
      1,
      0
    );
    if (hq && hq.length > 0) branchId = hq[0].id;
  } catch (err) {}

  try {
    const record = new Record($app.findCollectionByNameOrId("merchant_staff"));
    record.set("id", $security.randomString(15).toLowerCase());
    record.set("merchant", merchant.id);
    record.set("user", ownerId);
    record.set("name", name);
    record.set("phone", owner.getString("phone") || "");
    record.set("role_title", "Owner");
    record.set("is_active", true);
    record.set("sort_order", -1);
    if (branchId) record.set("branch", branchId);
    $app.save(record);
    console.log("[OWNER STAFF] Created staff row for owner " + name + " at merchant " + merchant.id);
    return record;
  } catch (err) {
    console.log("[OWNER STAFF] Failed to create owner staff row:", err && err.message ? err.message : err);
    return null;
  }
}

module.exports = {
  ensureOwnerStaff: ensureOwnerStaff,
  findOwnerStaff: findOwnerStaff,
};
