/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("system_settings");
    console.log("Collection system_settings already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    const collection = new Collection({
      "id": "pbc_sys_settings",
      "name": "system_settings",
      "type": "base",
      "system": false,
      "listRule": null,
      "viewRule": null,
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "options": {},
      "fields": [
        { "id": "text_id_sys", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate_cr_sys", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_sys", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "text_waba_sys", "name": "official_waba_id", "type": "text", "system": false, "required": false },
        { "id": "text_phid_sys", "name": "official_phone_number_id", "type": "text", "system": false, "required": false },
        { "id": "text_token_sys", "name": "official_access_token", "type": "text", "system": false, "required": false },
        { "id": "text_phone_sys", "name": "official_phone_number", "type": "text", "system": false, "required": false }
      ]
    });
    app.save(collection);

    // Seed default global settings record
    const settingsCol = app.findCollectionByNameOrId("system_settings");
    const defaultSettings = new Record(settingsCol);
    defaultSettings.set("id", "settingsglobal");
    defaultSettings.set("official_waba_id", "");
    defaultSettings.set("official_phone_number_id", "");
    defaultSettings.set("official_access_token", "");
    defaultSettings.set("official_phone_number", "");
    app.save(defaultSettings);

    return null;
  } catch (err) {
    console.log("Skip system_settings migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("system_settings");
    return app.delete(col);
  } catch (err) {
    return null;
  }
})
