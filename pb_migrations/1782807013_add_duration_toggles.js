/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const pricingSettings = app.findCollectionByNameOrId("pricing_settings");
    if (pricingSettings) {
      pricingSettings.fields.add(new Field({
        "id": "bool_enable_3m_ps",
        "name": "enable_3m",
        "type": "bool",
        "required": false
      }));
      pricingSettings.fields.add(new Field({
        "id": "bool_enable_6m_ps",
        "name": "enable_6m",
        "type": "bool",
        "required": false
      }));
      pricingSettings.fields.add(new Field({
        "id": "bool_enable_9m_ps",
        "name": "enable_9m",
        "type": "bool",
        "required": false
      }));
      pricingSettings.fields.add(new Field({
        "id": "bool_enable_12m_ps",
        "name": "enable_12m",
        "type": "bool",
        "required": false
      }));
      app.save(pricingSettings);
      
      // Update the existing default config record to set them true
      try {
        const record = app.findRecordById("pricing_settings", "pricesettings01");
        if (record) {
          record.set("enable_3m", true);
          record.set("enable_6m", true);
          record.set("enable_9m", true);
          record.set("enable_12m", true);
          app.save(record);
        }
      } catch (err) {
        console.log("Failed to seed toggles to record:", err);
      }
    }
  } catch (err) {
    console.log("Failed to add duration fields:", err.message || err);
  }
});
