/// <reference path="../pb_data/types.d.ts" />
// Backfill: give every merchant owner a `merchant_staff` row so they can be
// picked as a provider on the booking page. Idempotent — skips owners that
// already have one.
migrate((app) => {
  const merchants = app.findAllRecords("merchants");
  const staffCollection = app.findCollectionByNameOrId("merchant_staff");
  let created = 0;

  for (let i = 0; i < merchants.length; i++) {
    const merchant = merchants[i];
    const ownerId = merchant.getString("owner") || "";
    if (!ownerId) continue;

    let existing = [];
    try {
      existing = app.findRecordsByFilter(
        "merchant_staff",
        "merchant = '" + merchant.id + "' && user = '" + ownerId + "'",
        "created",
        1,
        0
      );
    } catch (err) {
      existing = [];
    }
    if (existing && existing.length > 0) continue;

    let owner = null;
    try {
      owner = app.findRecordById("users", ownerId);
    } catch (err) {
      continue;
    }

    let branchId = "";
    try {
      const hq = app.findRecordsByFilter(
        "branches",
        "merchant = '" + merchant.id + "' && is_hq = true",
        "-created",
        1,
        0
      );
      if (hq && hq.length > 0) branchId = hq[0].id;
    } catch (err) {}

    const record = new Record(staffCollection);
    record.set("merchant", merchant.id);
    record.set("user", ownerId);
    record.set("name", (owner.getString("name") || "").trim() || "Owner");
    record.set("phone", owner.getString("phone") || "");
    record.set("role_title", "Owner");
    record.set("is_active", true);
    record.set("sort_order", -1);
    if (branchId) record.set("branch", branchId);

    try {
      app.save(record);
      created += 1;
    } catch (err) {
      console.log("[MIGRATION 1793000002] Owner staff row failed for " + merchant.id + ": " + (err.message || err));
    }
  }

  console.log("[MIGRATION 1793000002] Created " + created + " owner staff row(s)");
}, (app) => {
  // Rows may already be referenced by bookings — leave them in place.
});
