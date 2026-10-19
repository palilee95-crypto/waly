/// <reference path="../pb_data/types.d.ts" />
// Collapse duplicate store_locations rows: keep one per merchant.
//
// The client upserts (check-then-create) but races/stale reads produced extras —
// e.g. SF Patners Store had 5 near-identical rows. Keep the most recently updated
// record for each merchant (ties keep the newest processed) and delete the rest.

migrate((app) => {
  const locations = app.findRecordsByFilter("store_locations", "id != ''", "-updated", 5000, 0);

  const keptByMerchant = {};
  const duplicates = [];

  locations.forEach(function (loc) {
    const merchantId = loc.getString("merchant");
    if (!merchantId) return;

    const current = keptByMerchant[merchantId];
    if (!current) {
      keptByMerchant[merchantId] = loc;
      return;
    }

    const currentAt = new Date(current.getString("updated").replace(" ", "T")).getTime() || 0;
    const candidateAt = new Date(loc.getString("updated").replace(" ", "T")).getTime() || 0;

    if (candidateAt > currentAt) {
      duplicates.push(current);
      keptByMerchant[merchantId] = loc;
    } else {
      duplicates.push(loc);
    }
  });

  duplicates.forEach(function (loc) {
    app.delete(loc);
  });

  console.log("[MIGRATION] store_locations dedupe: removed " + duplicates.length + " duplicate(s); " + Object.keys(keptByMerchant).length + " merchant location(s) kept");
}, (app) => {
  // no-op — deleted duplicates cannot be restored
});
