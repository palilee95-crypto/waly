// pb_hooks/system_settings.pb.js
// Auto-register default templates on the official WABA when system settings are updated

onRecordUpdate((e) => {
  try {
    const settings = e.record;
    if (!settings) return;
    const wabaId = settings.getString("official_waba_id");
    const accessToken = settings.getString("official_access_token");

    if (wabaId && accessToken) {
      console.log(`[System Settings Hook] Registering default templates for official WABA ID: ${wabaId}...`);
      const { registerAppTemplates } = require(`${__hooks}/whatsapp_helper.js`);
      registerAppTemplates(wabaId, accessToken);
    }
  } catch (err) {
    console.log("[System Settings Hook Error]", err.message || err);
  }
}, "system_settings");

onRecordCreate((e) => {
  try {
    const settings = e.record;
    if (!settings) return;
    const wabaId = settings.getString("official_waba_id");
    const accessToken = settings.getString("official_access_token");

    if (wabaId && accessToken) {
      console.log(`[System Settings Hook] Registering default templates for official WABA ID: ${wabaId}...`);
      const { registerAppTemplates } = require(`${__hooks}/whatsapp_helper.js`);
      registerAppTemplates(wabaId, accessToken);
    }
  } catch (err) {
    console.log("[System Settings Hook Error]", err.message || err);
  }
}, "system_settings");
