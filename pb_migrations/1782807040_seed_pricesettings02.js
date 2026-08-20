/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const settingsCol = app.findCollectionByNameOrId("pricing_settings");
  
  try {
    const existing = app.findRecordById("pricing_settings", "pricesettings02");
    if (existing) {
      console.log("[MIGRATION] pricesettings02 already exists, skipping seed.");
      return;
    }
  } catch (err) {}

  const nfcPricing = new Record(settingsCol);
  nfcPricing.set("id", "pricesettings02");
  nfcPricing.set("base_price_1m", 119); // 1x Stand Price (RM 119)
  nfcPricing.set("discount_3m", 198);   // 2x Stand (Duo) Price (RM 198)
  nfcPricing.set("discount_6m", 469);   // 5x Stand (Enterprise) Price (RM 469)
  nfcPricing.set("discount_9m", 12);
  nfcPricing.set("discount_12m", 15);
  nfcPricing.set("enable_3m", true);
  nfcPricing.set("enable_6m", true);
  nfcPricing.set("enable_9m", false);
  nfcPricing.set("enable_12m", false);
  
  app.save(nfcPricing);
  console.log("[MIGRATION] Successfully created pricesettings02 for NFC Hardware pricing.");
}, (app) => {
  try {
    const record = app.findRecordById("pricing_settings", "pricesettings02");
    if (record) {
      app.delete(record);
    }
  } catch (err) {}
});
