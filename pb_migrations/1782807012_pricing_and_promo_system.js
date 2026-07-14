/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Create pricing_settings collection
  const pricingSettings = new Collection({
    "id": "pricingsettings",
    "name": "pricing_settings",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "fields": [
      {
        "id": "text_id_ps",
        "name": "id",
        "type": "text",
        "system": true,
        "required": true,
        "primaryKey": true
      },
      {
        "id": "num_base_price_ps",
        "name": "base_price_1m",
        "type": "number",
        "required": true,
        "noDecimal": false
      },
      {
        "id": "num_discount_3m_ps",
        "name": "discount_3m",
        "type": "number",
        "required": true,
        "noDecimal": true
      },
      {
        "id": "num_discount_6m_ps",
        "name": "discount_6m",
        "type": "number",
        "required": true,
        "noDecimal": true
      },
      {
        "id": "num_discount_9m_ps",
        "name": "discount_9m",
        "type": "number",
        "required": true,
        "noDecimal": true
      },
      {
        "id": "num_discount_12m_ps",
        "name": "discount_12m",
        "type": "number",
        "required": true,
        "noDecimal": true
      }
    ]
  });
  app.save(pricingSettings);

  // 2. Create subscription_promo_codes collection
  const promoCodes = new Collection({
    "id": "promocodes12345",
    "name": "subscription_promo_codes",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "fields": [
      {
        "id": "text_id_spc",
        "name": "id",
        "type": "text",
        "system": true,
        "required": true,
        "primaryKey": true
      },
      {
        "id": "text_code_spc",
        "name": "code",
        "type": "text",
        "required": true
      },
      {
        "id": "text_type_spc",
        "name": "discount_type",
        "type": "text",
        "required": true
      },
      {
        "id": "num_val_spc",
        "name": "discount_value",
        "type": "number",
        "required": true
      },
      {
        "id": "bool_active_spc",
        "name": "is_active",
        "type": "bool",
        "required": false
      }
    ]
  });
  app.save(promoCodes);

  // 3. Seed default config
  const settingsCol = app.findCollectionByNameOrId("pricing_settings");
  const defaultSettings = new Record(settingsCol);
  defaultSettings.set("id", "pricesettings01");
  defaultSettings.set("base_price_1m", 119);
  defaultSettings.set("discount_3m", 5);
  defaultSettings.set("discount_6m", 10);
  defaultSettings.set("discount_9m", 12);
  defaultSettings.set("discount_12m", 15);
  app.save(defaultSettings);

  // 4. Seed sample promo codes
  const promoCol = app.findCollectionByNameOrId("subscription_promo_codes");
  
  const promo1 = new Record(promoCol);
  promo1.set("code", "RISEV10");
  promo1.set("discount_type", "percentage");
  promo1.set("discount_value", 10);
  promo1.set("is_active", true);
  app.save(promo1);

  const promo2 = new Record(promoCol);
  promo2.set("code", "RISEV50");
  promo2.set("discount_type", "fixed");
  promo2.set("discount_value", 50);
  promo2.set("is_active", true);
  app.save(promo2);

}, (app) => {
  const pricingSettings = app.findCollectionByNameOrId("pricing_settings");
  if (pricingSettings) {
    app.delete(pricingSettings);
  }
  const promoCodes = app.findCollectionByNameOrId("subscription_promo_codes");
  if (promoCodes) {
    app.delete(promoCodes);
  }
});
