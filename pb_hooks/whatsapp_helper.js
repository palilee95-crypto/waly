// pb_hooks/whatsapp_helper.js
// Official Meta Cloud API helper and Evolution Go mock fallback.

// Evolution Go configurations removed

// Pagination helper: fetch all records matching a filter by looping 500-record pages.
// PocketBase's findRecordsByFilter caps at perPage records per call — this loops until exhausted.
// Keep this fully functional!
function fetchAllRecords(collectionName, filter, sort) {
  const perPage = 500;
  let page = 0;
  let all = [];
  let batch;
  do {
    batch = $app.findRecordsByFilter(collectionName, filter, sort || "-created", perPage, page);
    for (let i = 0; i < batch.length; i++) all.push(batch[i]);
    page++;
  } while (batch.length === perPage);
  return all;
}

// Meta WhatsApp Business Cloud API sendTemplateMessage function
function sendTemplateMessage(merchantId, recipientPhone, templateName, languageCode, parameters) {
  // Support developer testing: redirect all messages to test number if specified in environment
  // (DISABLED - Now using real customer numbers)
  // const testNumber = $os.getenv("WHATSAPP_TEST_NUMBER");
  let finalRecipient = recipientPhone.replace(/[^\d]/g, '');
  /*
  if (testNumber) {
    const cleanTest = testNumber.replace(/[^\d]/g, '');
    if (cleanTest) {
      console.log(`[META API TEST FALLBACK] Redirecting message from ${finalRecipient} to sandbox test number ${cleanTest}`);
      finalRecipient = cleanTest;
    }
  }
  */

  // Normalize phone number to include country code (defaulting to +60 if Malaysian number without code)
  if (finalRecipient.indexOf("0") === 0) {
    finalRecipient = "60" + finalRecipient.slice(1);
  }
  if (finalRecipient.indexOf("60") !== 0 && finalRecipient.length >= 9) {
    finalRecipient = "60" + finalRecipient;
  }

  // 1. Check if the merchant has an active official Meta configuration
  let config = null;
  try {
    const configs = $app.findRecordsByFilter(
      "whatsapp_configurations",
      `merchant = '${merchantId}' && status = 'connected'`,
      "-created",
      1,
      0
    );
    if (configs.length > 0) {
      config = configs[0];
    }
  } catch (err) {
    // Collection or records not found
  }

  // 1b. Fallback to official platform settings ONLY for development/test merchant (bp6beunui7eq1il)
  if (!config && merchantId === "bp6beunui7eq1il") {
    try {
      const sysSettings = $app.findRecordById("system_settings", "settingsglobal");
      if (sysSettings) {
        const sysToken = sysSettings.getString("official_access_token");
        const sysPhoneId = sysSettings.getString("official_phone_number_id");
        const sysWabaId = sysSettings.getString("official_waba_id");
        
        if (sysToken && sysPhoneId) {
          // Construct a dynamic configuration object matching WABA schema
          config = {
            getString: function(key) {
              if (key === "access_token") return sysToken;
              if (key === "phone_number_id") return sysPhoneId;
              if (key === "waba_id") return sysWabaId;
              return "";
            }
          };
          console.log(`[META API DEV FALLBACK] Using official platform settings for developer merchant ${merchantId}`);
        }
      }
    } catch (err) {
      // system_settings not configured or not found
    }
  }

  // 2. If no configuration found, run in sandbox/mock mode
  if (!config) {
    console.log(`[MOCK META API] sendTemplateMessage: No active credentials found for merchant ${merchantId}.`);
    console.log(`[MOCK META API] Recipient: ${finalRecipient} | Template: "${templateName}" | Language: "${languageCode || 'en_US'}"`);
    console.log(`[MOCK META API] Parameters: ${JSON.stringify(parameters || [])}`);
    return { success: true, mock: true, messageId: "mock-" + Math.random().toString(36).substring(2, 10) };
  }

  // 3. Official Meta Cloud API dispatch
  const wabaId = config.getString("waba_id");
  const phoneNumberId = config.getString("phone_number_id");
  const accessToken = config.getString("access_token");

  const templateObj = {
    "name": templateName,
    "language": {
      "code": languageCode || "en_US"
    }
  };

  if (Array.isArray(parameters) && parameters.length > 0) {
    templateObj.components = [
      {
        "type": "body",
        "parameters": parameters.map(p => ({ "type": "text", "text": String(p) }))
      }
    ];
  }

  try {
    const res = $http.send({
      url: `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": finalRecipient,
        "type": "template",
        "template": templateObj
      })
    });

    console.log(`[META API] API request to ${phoneNumberId} completed with status ${res.statusCode}`);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const resData = JSON.parse(res.raw);
      const msgId = resData?.messages?.[0]?.id || "";
      return { success: true, messageId: msgId, raw: resData };
    } else {
      console.log(`[META API ERROR STATUS] Status: ${res.statusCode} | Raw: ${res.raw}`);
      return { success: false, error: res.raw };
    }
  } catch (err) {
    console.log(`[META API EXCEPTION] Failed to execute HTTP send:`, err.message || err);
    return { success: false, error: err.message || err };
  }
}

// Legacy Evolution Go mock functions removed

function getMerchantWabaConfig(merchantId) {
  let config = null;
  try {
    const configs = $app.findRecordsByFilter(
      "whatsapp_configurations",
      `merchant = '${merchantId}' && status = 'connected'`,
      "-created",
      1,
      0
    );
    if (configs.length > 0) {
      config = configs[0];
    }
  } catch (err) {}

  if (!config) {
    // Fallback to system platform settings if configured
    try {
      const sysSettings = $app.findRecordById("system_settings", "settingsglobal");
      if (sysSettings) {
        const sysToken = sysSettings.getString("official_access_token");
        const sysPhoneId = sysSettings.getString("official_phone_number_id");
        const sysWabaId = sysSettings.getString("official_waba_id");
        if (sysToken && sysWabaId) {
          return {
            wabaId: sysWabaId,
            phoneNumberId: sysPhoneId,
            accessToken: sysToken,
            isPlatform: true,
          };
        }
      }
    } catch (err) {}
    return null;
  }

  return {
    wabaId: config.getString("waba_id"),
    phoneNumberId: config.getString("phone_number_id"),
    accessToken: config.getString("access_token"),
    phoneNumber: config.getString("phone_number"),
    isPlatform: false,
  };
}

function listMessageTemplates(merchantId) {
  const config = getMerchantWabaConfig(merchantId);
  if (!config || !config.wabaId || !config.accessToken) {
    return { success: false, error: "WhatsApp is not connected for this merchant." };
  }

  try {
    const res = $http.send({
      url: `https://graph.facebook.com/v20.0/${config.wabaId}/message_templates?limit=100`,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const data = JSON.parse(res.raw);
      const templates = (data.data || []).map(t => {
        let bodyText = "";
        let headerText = "";
        let footerText = "";
        const components = t.components || [];
        for (let i = 0; i < components.length; i++) {
          if (components[i].type === "BODY") bodyText = components[i].text || "";
          if (components[i].type === "HEADER") headerText = components[i].text || "";
          if (components[i].type === "FOOTER") footerText = components[i].text || "";
        }
        return {
          id: t.id,
          name: t.name,
          status: t.status, // APPROVED, PENDING, REJECTED, PAUSED, DISABLED
          category: t.category, // MARKETING, UTILITY
          language: t.language,
          bodyText: bodyText,
          headerText: headerText,
          footerText: footerText,
          rejectedReason: t.rejected_reason || null,
        };
      });
      return { success: true, templates };
    } else {
      console.log(`[META LIST TEMPLATES ERROR] Status: ${res.statusCode} | Raw: ${res.raw}`);
      return { success: false, error: res.raw };
    }
  } catch (err) {
    console.log("[META LIST TEMPLATES EXCEPTION]:", err.message || err);
    return { success: false, error: err.message || err };
  }
}

function createMessageTemplate(merchantId, templateData) {
  const config = getMerchantWabaConfig(merchantId);
  if (!config || !config.wabaId || !config.accessToken) {
    return { success: false, error: "WhatsApp is not connected for this merchant." };
  }

  const rawName = (templateData.name || "").trim().toLowerCase();
  const cleanName = rawName.replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  if (!cleanName) {
    return { success: false, error: "Template name is required and can only contain letters, numbers, and underscores." };
  }

  const category = (templateData.category || "MARKETING").toUpperCase();
  const language = templateData.language || "en_US";
  const bodyText = (templateData.bodyText || "").trim();

  if (!bodyText) {
    return { success: false, error: "Template body text is required." };
  }

  // Detect variables like {{1}}, {{2}}, etc.
  const varMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
  const uniqueVars = Array.from(new Set(varMatches));
  
  const components = [];

  // Optional Header
  if (templateData.headerText && templateData.headerText.trim()) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: templateData.headerText.trim(),
    });
  }

  // Body Component
  const bodyComponent = {
    type: "BODY",
    text: bodyText,
  };

  if (uniqueVars.length > 0) {
    // Provide sample examples for each variable
    const sampleValues = Array.isArray(templateData.sampleValues) && templateData.sampleValues.length >= uniqueVars.length
      ? templateData.sampleValues.slice(0, uniqueVars.length)
      : uniqueVars.map((v, i) => `Sample ${i + 1}`);

    bodyComponent.example = {
      body_text: [sampleValues.map(s => String(s))]
    };
  }

  components.push(bodyComponent);

  // Optional Footer
  if (templateData.footerText && templateData.footerText.trim()) {
    components.push({
      type: "FOOTER",
      text: templateData.footerText.trim(),
    });
  }

  const payload = {
    name: cleanName,
    category: category,
    language: language,
    components: components,
  };

  try {
    const res = $http.send({
      url: `https://graph.facebook.com/v20.0/${config.wabaId}/message_templates`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log(`[META CREATE TEMPLATE] Created template ${cleanName} on ${config.wabaId}. Status: ${res.statusCode}. Response: ${res.raw}`);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const data = JSON.parse(res.raw);
      return { success: true, template: data };
    } else {
      let errMsg = res.raw;
      try {
        const parsed = JSON.parse(res.raw);
        if (parsed.error && parsed.error.message) errMsg = parsed.error.message;
      } catch (_) {}
      return { success: false, error: errMsg };
    }
  } catch (err) {
    console.log("[META CREATE TEMPLATE EXCEPTION]:", err.message || err);
    return { success: false, error: err.message || err };
  }
}

function deleteMessageTemplate(merchantId, templateName) {
  const config = getMerchantWabaConfig(merchantId);
  if (!config || !config.wabaId || !config.accessToken) {
    return { success: false, error: "WhatsApp is not connected for this merchant." };
  }

  const cleanName = encodeURIComponent(String(templateName || "").trim());
  if (!cleanName) {
    return { success: false, error: "Template name is required." };
  }

  try {
    const res = $http.send({
      url: `https://graph.facebook.com/v20.0/${config.wabaId}/message_templates?name=${cleanName}`,
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      }
    });

    console.log(`[META DELETE TEMPLATE] Delete template ${cleanName}. Status: ${res.statusCode}. Response: ${res.raw}`);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { success: true };
    } else {
      return { success: false, error: res.raw };
    }
  } catch (err) {
    console.log("[META DELETE TEMPLATE EXCEPTION]:", err.message || err);
    return { success: false, error: err.message || err };
  }
}

function subscribeWabaApp(wabaId, accessToken) {
  try {
    const res = $http.send({
      url: `https://graph.facebook.com/v20.0/${wabaId}/subscribed_apps`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });
    console.log(`[META SUBSCRIBED_APPS] Status: ${res.statusCode} | Response: ${res.raw}`);
    return { success: res.statusCode >= 200 && res.statusCode < 300, raw: res.raw };
  } catch (err) {
    console.log("[META SUBSCRIBED_APPS EXCEPTION]:", err.message || err);
    return { success: false, error: err.message || err };
  }
}

function syncBusinessProfile(phoneNumberId, accessToken, profileData) {
  try {
    const body = {
      messaging_product: "whatsapp",
      about: profileData.about || "Loyalty & Rewards Program",
      description: profileData.description || "Official WhatsApp channel",
      vertical: profileData.vertical || "RETAIL"
    };
    if (profileData.website) {
      body.websites = [profileData.website];
    }
    const res = $http.send({
      url: `https://graph.facebook.com/v20.0/${phoneNumberId}/whatsapp_business_profile`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    console.log(`[META BUSINESS PROFILE SYNC] Status: ${res.statusCode} | Response: ${res.raw}`);
    return { success: res.statusCode >= 200 && res.statusCode < 300, raw: res.raw };
  } catch (err) {
    console.log("[META BUSINESS PROFILE EXCEPTION]:", err.message || err);
    return { success: false, error: err.message || err };
  }
}

function registerAppTemplates(wabaId, accessToken) {
  const templates = [
    {
      "name": "risev_notification",
      "category": "UTILITY",
      "language": "en_US",
      "components": [
        {
          "type": "BODY",
          "text": "Message from {{1}}\n\n*{{2}}*\n\n{{3}}",
          "example": {
            "body_text": [
              ["Store Name", "Notification", "This is a test notification message."]
            ]
          }
        }
      ]
    },
    {
      "name": "stamp_earned_v1",
      "category": "UTILITY",
      "language": "en_US",
      "components": [
        {
          "type": "BODY",
          "text": "Hi {{1}}, you just received {{2}} stamp(s) at {{3}}! Your total balance is now {{4}} stamp(s).",
          "example": {
            "body_text": [
              ["Customer", "1", "Coffee House", "5"]
            ]
          }
        }
      ]
    },
    {
      "name": "voucher_received_v1",
      "category": "UTILITY",
      "language": "en_US",
      "components": [
        {
          "type": "BODY",
          "text": "Congratulations {{1}}! You have unlocked a new reward: *{{2}}* at {{3}}. Your voucher code is *{{4}}*.",
          "example": {
            "body_text": [
              ["Customer", "Free Iced Latte", "Coffee House", "WV-9821-4820"]
            ]
          }
        }
      ]
    },
    {
      "name": "risev_campaign",
      "category": "MARKETING",
      "language": "en_US",
      "components": [
        {
          "type": "BODY",
          "text": "Exclusive update from {{1}}\n\n*{{2}}*\n\n{{3}}",
          "example": {
            "body_text": [
              ["Store Name", "Promotion", "This is a test marketing message."]
            ]
          }
        }
      ]
    }
  ];

  for (let i = 0; i < templates.length; i++) {
    const tmpl = templates[i];
    try {
      const res = $http.send({
        url: `https://graph.facebook.com/v20.0/${wabaId}/message_templates`,
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(tmpl)
      });
      console.log(`[META TEMPLATE] Created template ${tmpl.name} on ${wabaId}. Status: ${res.statusCode}. Response: ${res.raw}`);
    } catch (err) {
      console.log(`[META TEMPLATE EXCEPTION] Failed to create template ${tmpl.name}:`, err.message || err);
    }
  }
}

module.exports = {
  sendTemplateMessage,
  fetchAllRecords,
  registerAppTemplates,
  getMerchantWabaConfig,
  listMessageTemplates,
  createMessageTemplate,
  deleteMessageTemplate,
  subscribeWabaApp,
  syncBusinessProfile
};
