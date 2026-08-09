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
  registerAppTemplates
};
