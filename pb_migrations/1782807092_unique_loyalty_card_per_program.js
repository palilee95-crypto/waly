/// <reference path="../pb_data/types.d.ts" />
// Every card-creation path looks up an existing card before inserting
// (manual_give / nfc_transaction by `program + customer`, the merchant app by
// `customer + merchant`), so a returning customer reuses their card and does
// not consume a second slot of the customer quota. That dedupe was only
// convention — `loyalty_cards` had plain indexes on `customer` and `program`
// but nothing preventing two rows for the same pair, so two simultaneous
// first-time stamps could both pass the lookup and mint two cards (and charge
// the merchant twice against their 300/500 member cap).
//
// This adds the missing unique constraint. Both columns are required, so no
// NULLs are involved.
//
// The migration checks for pre-existing duplicates first and skips (logging)
// rather than throwing, because a failing migration aborts PocketBase startup.
// Production was audited before writing this: 996 cards, 977 distinct
// customers, 0 duplicate (customer, program) pairs.

migrate((app) => {
  try {
    const cardsCol = app.findCollectionByNameOrId("loyalty_cards");
    if (!cardsCol) {
      console.log("[MIGRATION 1782807092] loyalty_cards not found, skipping");
      return;
    }

    const indexName = "idx_loyalty_cards_customer_program";
    const indexes = cardsCol.indexes || [];
    for (let i = 0; i < indexes.length; i++) {
      if (String(indexes[i]).indexOf(indexName) !== -1) {
        console.log("[MIGRATION 1782807092] unique index already present, skipping");
        return;
      }
    }

    let duplicates = 0;
    let scanned = 0;
    try {
      const rows = app.findRecordsByFilter("loyalty_cards", "id != ''", "created", 10000, 0);
      scanned = rows.length;
      const seen = {};
      for (let i = 0; i < rows.length; i++) {
        const key = rows[i].getString("customer") + "|" + rows[i].getString("program");
        if (seen[key]) {
          duplicates++;
        } else {
          seen[key] = true;
        }
      }
    } catch (scanErr) {
      console.log("[MIGRATION 1782807092] duplicate scan failed:", scanErr.message || scanErr);
    }

    if (duplicates > 0) {
      console.log(
        "[MIGRATION 1782807092] SKIPPED unique index — " + duplicates +
        " duplicate (customer, program) pair(s) across " + scanned +
        " card(s). Dedupe them, then re-run."
      );
      return;
    }

    cardsCol.indexes = indexes.concat([
      "CREATE UNIQUE INDEX `" + indexName + "` ON `loyalty_cards` (`customer`, `program`)"
    ]);
    app.save(cardsCol);
    console.log(
      "[MIGRATION 1782807092] unique index on loyalty_cards(customer, program) created — " +
      scanned + " card(s) checked, no duplicates"
    );
  } catch (err) {
    console.log("[MIGRATION 1782807092] Error creating unique index:", err.message || err);
  }
}, (app) => {
  try {
    const cardsCol = app.findCollectionByNameOrId("loyalty_cards");
    if (!cardsCol) return;
    cardsCol.indexes = (cardsCol.indexes || []).filter((idx) => {
      return String(idx).indexOf("idx_loyalty_cards_customer_program") === -1;
    });
    app.save(cardsCol);
  } catch (err) {}
});
