/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const pricingSettings = app.findCollectionByNameOrId("pricing_settings");
    if (pricingSettings) {
      pricingSettings.fields.add(new Field({
        "id": "num_agent_t1_min",
        "name": "agent_tier_1_min_merchants",
        "type": "number",
        "required": false,
        "noDecimal": true
      }));
      pricingSettings.fields.add(new Field({
        "id": "num_agent_t2_min",
        "name": "agent_tier_2_min_merchants",
        "type": "number",
        "required": false,
        "noDecimal": true
      }));
      pricingSettings.fields.add(new Field({
        "id": "num_agent_t3_min",
        "name": "agent_tier_3_min_merchants",
        "type": "number",
        "required": false,
        "noDecimal": true
      }));
      app.save(pricingSettings);

      // Seed default merchant count thresholds to record 'pricesettings01'
      try {
        const record = app.findRecordById("pricing_settings", "pricesettings01");
        if (record) {
          if (record.get("agent_tier_1_min_merchants") === undefined) record.set("agent_tier_1_min_merchants", 0);
          if (record.get("agent_tier_2_min_merchants") === undefined) record.set("agent_tier_2_min_merchants", 15);
          if (record.get("agent_tier_3_min_merchants") === undefined) record.set("agent_tier_3_min_merchants", 30);
          app.save(record);
        }
      } catch (err) {
        console.log("Failed to seed agent tier thresholds to record:", err);
      }
    }
  } catch (err) {
    console.log("Failed to add agent tier threshold fields to pricing_settings:", err.message || err);
  }
});
