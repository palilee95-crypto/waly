/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const pricingSettings = app.findCollectionByNameOrId("pricing_settings");
    if (pricingSettings) {
      pricingSettings.updateRule = "@request.auth.id != ''";
      
      pricingSettings.fields.add(new Field({
        "id": "num_agent_t1_rate",
        "name": "agent_tier_1_rate",
        "type": "number",
        "required": false,
        "noDecimal": false
      }));
      pricingSettings.fields.add(new Field({
        "id": "num_agent_t2_rate",
        "name": "agent_tier_2_rate",
        "type": "number",
        "required": false,
        "noDecimal": false
      }));
      pricingSettings.fields.add(new Field({
        "id": "num_agent_t3_rate",
        "name": "agent_tier_3_rate",
        "type": "number",
        "required": false,
        "noDecimal": false
      }));
      app.save(pricingSettings);

      // Seed default tier rates to record 'pricesettings01'
      try {
        const record = app.findRecordById("pricing_settings", "pricesettings01");
        if (record) {
          if (!record.get("agent_tier_1_rate")) record.set("agent_tier_1_rate", 10);
          if (!record.get("agent_tier_2_rate")) record.set("agent_tier_2_rate", 15);
          if (!record.get("agent_tier_3_rate")) record.set("agent_tier_3_rate", 20);
          app.save(record);
        }
      } catch (err) {
        console.log("Failed to seed agent tier rates to pricesettings01 record:", err);
      }
    }
  } catch (err) {
    console.log("Failed to add agent tier rates to pricing_settings:", err.message || err);
  }
});
