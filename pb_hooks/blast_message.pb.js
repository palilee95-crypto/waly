// pb_hooks/blast_message.pb.js

// 1. GET WhatsApp Connection Status & Pairing QR Code
routerAdd("GET", "/api/risev/merchant/whatsapp/status", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

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

    if (config) {
      return e.json(200, {
        status: "connected",
        phone: config.getString("phone_number")
      });
    }

    return e.json(200, { status: "disconnected" });
  } catch (err) {
    return e.json(500, { message: err.message || err });
  }
}, $apis.requireAuth("users"));

// 1b. POST Pair WhatsApp with phone number (pairing code — no QR needed)
routerAdd("POST", "/api/risev/merchant/whatsapp/pair", (e) => {
  return e.json(400, { message: "WhatsApp service has been decommissioned." });
}, $apis.requireAuth("users"));

// 2. POST Disconnect & Delete WhatsApp Instance
routerAdd("POST", "/api/risev/merchant/whatsapp/disconnect", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

    try {
      const configs = $app.findRecordsByFilter(
        "whatsapp_configurations",
        `merchant = '${merchantId}'`,
        "-created",
        10,
        0
      );
      for (let i = 0; i < configs.length; i++) {
        $app.delete(configs[i]);
      }
    } catch (err) {}

    return e.json(200, { success: true });
  } catch (err) {
    return e.json(500, { message: err.message || err });
  }
}, $apis.requireAuth("users"));

// 2b. GET WhatsApp Business Message Templates (from Meta Cloud API)
routerAdd("GET", "/api/risev/merchant/whatsapp/templates", (e) => {
  const { listMessageTemplates, getMerchantWabaConfig } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

    const config = getMerchantWabaConfig(merchantId);
    if (!config) {
      // Return starter sandbox presets if not connected
      return e.json(200, {
        templates: [
          {
            name: "winback_7day_mock",
            status: "APPROVED",
            category: "MARKETING",
            language: "en_US",
            bodyText: "We miss you, {{1}}! Come back to {{2}} to collect more stamps.",
            headerText: "",
            footerText: "Reply STOP to unsubscribe",
          },
          {
            name: "visit_thank_you_mock",
            status: "APPROVED",
            category: "UTILITY",
            language: "en_US",
            bodyText: "Hi {{1}}, thanks for visiting {{2}}! You collected {{3}} stamps today.",
            headerText: "Thank You! ✨",
            footerText: "",
          }
        ],
        sandbox: true,
        connected: false
      });
    }

    const res = listMessageTemplates(merchantId);
    if (res.success) {
      return e.json(200, { templates: res.templates || [], sandbox: false, connected: true });
    } else {
      return e.json(400, { message: res.error || "Failed to fetch templates from Meta", templates: [], connected: true });
    }
  } catch (err) {
    console.log(`[META TEMPLATE EXCEPTION]`, err.message || err);
    return e.json(500, { message: err.message || err });
  }
}, $apis.requireAuth("users"));

// 2b-2. POST Create WhatsApp Business Message Template
routerAdd("POST", "/api/risev/merchant/whatsapp/templates/create", (e) => {
  const { createMessageTemplate } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    if (authRecord.get("role") !== "merchant" && authRecord.get("role") !== "both") {
      return e.json(403, { message: "Forbidden. Merchant account required." });
    }

    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

    const body = e.requestInfo().body || {};
    const res = createMessageTemplate(merchantId, body);

    if (res.success) {
      return e.json(200, {
        success: true,
        message: "Template submitted to Meta successfully! Review usually completes in 1-2 minutes.",
        template: res.template
      });
    } else {
      return e.json(400, { success: false, message: res.error || "Failed to create template on Meta" });
    }
  } catch (err) {
    return e.json(500, { message: "Error creating template: " + (err.message || err) });
  }
}, $apis.requireAuth("users"));

// 2b-3. POST Delete WhatsApp Business Message Template
routerAdd("POST", "/api/risev/merchant/whatsapp/templates/delete", (e) => {
  const { deleteMessageTemplate } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    if (authRecord.get("role") !== "merchant" && authRecord.get("role") !== "both") {
      return e.json(403, { message: "Forbidden. Merchant account required." });
    }

    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

    const body = e.requestInfo().body || {};
    const templateName = body.name || body.template_name || "";
    if (!templateName) {
      return e.json(400, { message: "Template name is required" });
    }

    const res = deleteMessageTemplate(merchantId, templateName);
    if (res.success) {
      return e.json(200, { success: true, message: "Template deleted successfully." });
    } else {
      return e.json(400, { success: false, message: res.error || "Failed to delete template from Meta" });
    }
  } catch (err) {
    return e.json(500, { message: "Error deleting template: " + (err.message || err) });
  }
}, $apis.requireAuth("users"));

// 2c. GET Meta OAuth Callback Endpoint
routerAdd("GET", "/api/risev/merchant/whatsapp/callback", (e) => {
  try {
    const query = e.requestInfo().query;
    const code = query.code;
    const stateStr = query.state;

    if (!code || !stateStr) {
      return e.string(400, "Missing OAuth code or state parameter.");
    }

    // 1. Decode state JSON
    let merchantId = "";
    let redirectHost = "https://risev.app"; // default fallback
    let callbackUrl = "";
    try {
      const decodedState = JSON.parse(decodeURIComponent(stateStr));
      merchantId = decodedState.merchantId;
      if (decodedState.redirectHost) {
        redirectHost = decodedState.redirectHost;
      }
      if (decodedState.callbackUrl) {
        callbackUrl = decodedState.callbackUrl;
      }
    } catch (err) {
      // Fallback if state is raw merchantId string
      merchantId = stateStr;
    }

    if (!merchantId) {
      return e.string(400, "Invalid state (missing merchantId).");
    }

    // 2. Fetch Meta Developer App Secrets
    const fbAppId = $os.getenv("META_APP_ID") || "YOUR_META_APP_ID"; 
    const fbAppSecret = $os.getenv("META_APP_SECRET") || "YOUR_META_APP_SECRET";
    
    if (!callbackUrl) {
      callbackUrl = `${redirectHost}/api/risev/merchant/whatsapp/callback`; // must match OAuth settings
    }

    if (fbAppId === "YOUR_META_APP_ID" || fbAppSecret === "YOUR_META_APP_SECRET") {
      console.log("[META OAUTH] WARNING: App ID or Secret is not configured in environment variables!");
    }

    // 3. Exchange code for User Access Token
    console.log(`[META OAUTH] Exchanging code for token. Redirect URI: ${callbackUrl}`);
    const tokenRes = $http.send({
      url: "https://graph.facebook.com/v20.0/oauth/access_token",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: fbAppId,
        client_secret: fbAppSecret,
        redirect_uri: callbackUrl,
        code: code
      })
    });

    if (tokenRes.statusCode < 200 || tokenRes.statusCode >= 300) {
      console.log(`[META OAUTH ERROR] Code exchange failed: ${tokenRes.statusCode} | ${tokenRes.raw}`);
      return e.string(tokenRes.statusCode, `Failed to exchange token with Meta: ${tokenRes.raw}`);
    }

    const tokenData = JSON.parse(tokenRes.raw);
    const userAccessToken = tokenData.access_token;

    let wabaId = "";
    let debugError = "";
    let debugRaw = "";
    let businessesError = "";
    let businessesRaw = "";

    // 4. Fetch WhatsApp Business Account (WABA) details
    // First, try using the debug_token endpoint (standard for Embedded Signup)
    try {
      console.log("[META OAUTH] Attempting debug_token to find WABA ID");
      const debugRes = $http.send({
        url: `https://graph.facebook.com/v20.0/debug_token?input_token=${userAccessToken}&access_token=${fbAppId}|${fbAppSecret}`,
        method: "GET"
      });

      debugRaw = debugRes.raw;
      if (debugRes.statusCode >= 200 && debugRes.statusCode < 300) {
        const debugData = JSON.parse(debugRes.raw);
        const granularScopes = (debugData.data && debugData.data.granular_scopes) || [];
        for (let i = 0; i < granularScopes.length; i++) {
          const s = granularScopes[i];
          if (s.scope === "whatsapp_business_management") {
            if (s.target_ids && s.target_ids.length > 0) {
              wabaId = s.target_ids[0];
              console.log(`[META OAUTH] Found WABA ID from debug_token: ${wabaId}`);
              break;
            }
          }
        }
      } else {
        console.log(`[META OAUTH ERROR] debug_token failed: ${debugRes.raw}`);
        debugError = `Status ${debugRes.statusCode}: ${debugRes.raw}`;
      }
    } catch (err) {
      console.log(`[META OAUTH EXCEPTION] debug_token failed:`, err.message || err);
      debugError = `Exception: ${err.message || err}`;
    }

    // Second, if debug_token failed to find it, try listing businesses as fallback
    if (!wabaId) {
      try {
        console.log("[META OAUTH] Fallback: listing businesses to find WABA ID");
        const businessesRes = $http.send({
          url: `https://graph.facebook.com/v20.0/me/businesses`,
          method: "GET",
          headers: {
            "Authorization": `Bearer ${userAccessToken}`
          }
        });

        businessesRaw = businessesRes.raw;
        if (businessesRes.statusCode >= 200 && businessesRes.statusCode < 300) {
          const businessesData = JSON.parse(businessesRes.raw);
          const businesses = businessesData.data || [];
          for (let i = 0; i < businesses.length; i++) {
            const biz = businesses[i];
            const bizWabaRes = $http.send({
              url: `https://graph.facebook.com/v20.0/${biz.id}/owned_whatsapp_business_accounts`,
              method: "GET",
              headers: {
                "Authorization": `Bearer ${userAccessToken}`
              }
            });
            if (bizWabaRes.statusCode >= 200 && bizWabaRes.statusCode < 300) {
              const bizWabaData = JSON.parse(bizWabaRes.raw);
              const bizWabas = bizWabaData.data || [];
              if (bizWabas.length > 0) {
                wabaId = bizWabas[0].id;
                console.log(`[META OAUTH] Found WABA ID from business ${biz.id}: ${wabaId}`);
                break;
              }
            } else {
              businessesError += `[Biz ${biz.id} WABA Error status ${bizWabaRes.statusCode}: ${bizWabaRes.raw}] `;
            }
          }
        } else {
          businessesError = `Businesses status ${businessesRes.statusCode}: ${businessesRes.raw}`;
        }
      } catch (err) {
        console.log(`[META OAUTH EXCEPTION] business fallback failed:`, err.message || err);
        businessesError = `Exception: ${err.message || err}`;
      }
    }

    if (!wabaId) {
      const errorMsg = {
        message: "Could not retrieve your WhatsApp Business Account (WABA) ID. Please make sure the app permissions are configured correctly.",
        meta_app_id: fbAppId,
        meta_app_secret_length: fbAppSecret ? fbAppSecret.length : 0,
        debug_token_response: debugRaw || debugError,
        businesses_response: businessesRaw || businessesError
      };
      return e.string(400, JSON.stringify(errorMsg, null, 2));
    }

    // 5. Fetch Phone Numbers inside this WABA
    const numbersRes = $http.send({
      url: `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers`,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${userAccessToken}`
      }
    });

    if (numbersRes.statusCode < 200 || numbersRes.statusCode >= 300) {
      console.log(`[META OAUTH ERROR] Failed to fetch phone numbers: ${numbersRes.raw}`);
      return e.string(numbersRes.statusCode, `Failed to fetch phone numbers from Meta: ${numbersRes.raw}`);
    }

    const numbersData = JSON.parse(numbersRes.raw);
    const numbers = numbersData.data || [];
    if (numbers.length === 0) {
      return e.string(400, "No verified phone numbers found inside your WhatsApp Business Account.");
    }

    const activeNum = numbers[0];
    const phoneNumberId = activeNum.id;
    const verifiedPhone = activeNum.display_phone_number || "";

    // 6. Save or Update in whatsapp_configurations collection
    let configRecord = null;
    try {
      const records = $app.findRecordsByFilter(
        "whatsapp_configurations",
        `merchant = '${merchantId}'`,
        "-created",
        1,
        0
      );
      if (records.length > 0) {
        configRecord = records[0];
      }
    } catch (err) {}

    if (configRecord) {
      configRecord.set("waba_id", wabaId);
      configRecord.set("phone_number_id", phoneNumberId);
      configRecord.set("access_token", userAccessToken);
      configRecord.set("phone_number", verifiedPhone);
      configRecord.set("status", "connected");
      $app.save(configRecord);
    } else {
      const collection = $app.findCollectionByNameOrId("whatsapp_configurations");
      const record = new Record(collection);
      record.set("id", $security.randomString(15).toLowerCase());
      record.set("merchant", merchantId);
      record.set("waba_id", wabaId);
      record.set("phone_number_id", phoneNumberId);
      record.set("access_token", userAccessToken);
      record.set("phone_number", verifiedPhone);
      record.set("status", "connected");
      $app.save(record);
    }

    // 7. Auto-register default templates on the WABA
    try {
      const { registerAppTemplates } = require(`${__hooks}/whatsapp_helper.js`);
      registerAppTemplates(wabaId, userAccessToken);
    } catch (tmplErr) {
      console.log(`[META OAUTH TEMPLATE ERROR] Failed to auto-register WABA templates:`, tmplErr.message || tmplErr);
    }

    console.log(`[META OAUTH SUCCESS] Successfully configured WhatsApp for merchant ${merchantId}. Phone: ${verifiedPhone}`);

    // 7. Redirect back to frontend
    e.response.header().set("Location", `${redirectHost}/(merchant)/profile?whatsapp=success`);
    return e.string(302, "Redirecting...");
  } catch (err) {
    console.log("[META OAUTH EXCEPTION]", err.message || err);
    return e.string(500, `Internal Server Error: ${err.message || err}`);
  }
});

// 2d. POST In-App Embedded Signup Completion (Popup / Session Listener Flow)
routerAdd("POST", "/api/risev/merchant/whatsapp/meta-connect", (e) => {
  const { registerAppTemplates, subscribeWabaApp, syncBusinessProfile } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

    const body = e.requestInfo().body;
    const code = body.code;
    let wabaId = body.wabaId || body.waba_id || "";
    let phoneNumberId = body.phoneNumberId || body.phone_number_id || "";

    if (!code) {
      return e.json(400, { message: "Missing authorization code from Meta Embedded Signup." });
    }

    // 1. Fetch Meta Developer App Secrets
    const fbAppId = $os.getenv("META_APP_ID") || "YOUR_META_APP_ID"; 
    const fbAppSecret = $os.getenv("META_APP_SECRET") || "YOUR_META_APP_SECRET";

    // 2. Exchange code for permanent / system user token
    console.log(`[META POPUP CONNECT] Exchanging code for token for merchant ${merchantId}`);
    const tokenRes = $http.send({
      url: "https://graph.facebook.com/v20.0/oauth/access_token",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: fbAppId,
        client_secret: fbAppSecret,
        code: code
      })
    });

    if (tokenRes.statusCode < 200 || tokenRes.statusCode >= 300) {
      console.log(`[META POPUP ERROR] Code exchange failed: ${tokenRes.statusCode} | ${tokenRes.raw}`);
      return e.json(tokenRes.statusCode, { message: `Failed to exchange token with Meta: ${tokenRes.raw}` });
    }

    const tokenData = JSON.parse(tokenRes.raw);
    const userAccessToken = tokenData.access_token;

    // 3. Resolve WABA ID if not already provided by session listener
    if (!wabaId) {
      try {
        const debugRes = $http.send({
          url: `https://graph.facebook.com/v20.0/debug_token?input_token=${userAccessToken}&access_token=${fbAppId}|${fbAppSecret}`,
          method: "GET"
        });
        if (debugRes.statusCode >= 200 && debugRes.statusCode < 300) {
          const debugData = JSON.parse(debugRes.raw);
          const granularScopes = (debugData.data && debugData.data.granular_scopes) || [];
          for (let i = 0; i < granularScopes.length; i++) {
            const s = granularScopes[i];
            if (s.scope === "whatsapp_business_management" && s.target_ids && s.target_ids.length > 0) {
              wabaId = s.target_ids[0];
              break;
            }
          }
        }
      } catch (debugErr) {
        console.log("[META POPUP DEBUG ERROR]:", debugErr.message || debugErr);
      }
    }

    if (!wabaId) {
      return e.json(400, { message: "Could not retrieve WhatsApp Business Account (WABA) ID from Meta." });
    }

    // 4. Fetch / verify Phone Number
    let verifiedPhone = "";
    const numbersRes = $http.send({
      url: `https://graph.facebook.com/v20.0/${wabaId}/phone_numbers`,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${userAccessToken}`
      }
    });

    if (numbersRes.statusCode >= 200 && numbersRes.statusCode < 300) {
      const numbersData = JSON.parse(numbersRes.raw);
      const numbers = numbersData.data || [];
      if (numbers.length > 0) {
        // Match specific phone number id if provided, else use first active number
        let matched = numbers.find(n => n.id === phoneNumberId) || numbers[0];
        phoneNumberId = matched.id;
        verifiedPhone = matched.display_phone_number || "";
      }
    }

    if (!phoneNumberId) {
      return e.json(400, { message: "No registered phone numbers found in your WhatsApp Business Account." });
    }

    // 5. Save or Update in whatsapp_configurations collection
    let configRecord = null;
    try {
      const records = $app.findRecordsByFilter(
        "whatsapp_configurations",
        `merchant = '${merchantId}'`,
        "-created",
        1,
        0
      );
      if (records.length > 0) {
        configRecord = records[0];
      }
    } catch (err) {}

    if (configRecord) {
      configRecord.set("waba_id", wabaId);
      configRecord.set("phone_number_id", phoneNumberId);
      configRecord.set("access_token", userAccessToken);
      configRecord.set("phone_number", verifiedPhone);
      configRecord.set("status", "connected");
      $app.save(configRecord);
    } else {
      const collection = $app.findCollectionByNameOrId("whatsapp_configurations");
      const record = new Record(collection);
      record.set("id", $security.randomString(15).toLowerCase());
      record.set("merchant", merchantId);
      record.set("waba_id", wabaId);
      record.set("phone_number_id", phoneNumberId);
      record.set("access_token", userAccessToken);
      record.set("phone_number", verifiedPhone);
      record.set("status", "connected");
      $app.save(record);
    }

    // 6. Auto-bind webhooks via Subscribed Apps API
    subscribeWabaApp(wabaId, userAccessToken);

    // 7. Auto-sync Merchant Business Profile
    try {
      const mRec = $app.findRecordById("merchants", merchantId);
      if (mRec) {
        syncBusinessProfile(phoneNumberId, userAccessToken, {
          about: mRec.getString("name") + " Rewards & Loyalty",
          description: mRec.getString("description") || "Official WhatsApp channel",
          website: mRec.getString("website") || ""
        });
      }
    } catch (profErr) {
      console.log("[META POPUP PROFILE SYNC WARNING]:", profErr.message || profErr);
    }

    // 8. Auto-register default loyalty templates on the WABA
    try {
      registerAppTemplates(wabaId, userAccessToken);
    } catch (tmplErr) {
      console.log("[META POPUP TEMPLATE WARNING]:", tmplErr.message || tmplErr);
    }

    console.log(`[META POPUP SUCCESS] Merchant ${merchantId} connected WhatsApp (${verifiedPhone}) successfully!`);

    return e.json(200, {
      success: true,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      phone_number: verifiedPhone,
      status: "connected"
    });
  } catch (err) {
    console.log("[META POPUP CONNECT EXCEPTION]", err.message || err);
    return e.json(500, { message: `Internal server error: ${err.message || err}` });
  }
}, $apis.requireAuth("users"));

// 2e. POST Send Live Test Message
routerAdd("POST", "/api/risev/merchant/whatsapp/send-test", (e) => {
  const { sendTemplateMessage } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

    const body = e.requestInfo().body;
    let targetPhone = body.phone || authRecord.get("phone") || "";
    if (!targetPhone) {
      return e.json(400, { message: "Recipient phone number is required." });
    }

    let storeName = "RISEV Loyalty";
    try {
      const mRec = $app.findRecordById("merchants", merchantId);
      if (mRec && mRec.getString("name")) {
        storeName = mRec.getString("name");
      }
    } catch (e) {}

    const result = sendTemplateMessage(
      merchantId,
      targetPhone,
      "risev_notification",
      "en_US",
      [storeName, "Test Notification", "Your Risev WhatsApp Cloud API is connected and working perfectly! 🎉"]
    );

    if (result.success) {
      return e.json(200, { success: true, messageId: result.messageId });
    } else {
      return e.json(400, { success: false, error: result.error || "Failed to send test message" });
    }
  } catch (err) {
    return e.json(500, { message: err.message || err });
  }
}, $apis.requireAuth("users"));

// 3. POST Blast Message to Customers
routerAdd("POST", "/api/risev/merchant/blast", (e) => {
  const { sendTemplateMessage, fetchAllRecords } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    if (authRecord.get("role") !== "merchant" && authRecord.get("role") !== "both") {
      return e.json(403, { message: "Forbidden" });
    }

    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

    const body = e.requestInfo().body;
    const title = body.title || "";
    const messageTemplate = body.message || "";
    const campaignId = body.campaignId || "";
    const targetCustomerIds = body.targetCustomerIds || null; // Optional list of user IDs to filter
    const hasMetaConfig = $app.findRecordsByFilter("whatsapp_configurations", `merchant = "${merchantId}" && status = "connected"`).length > 0;
    const sendWhatsApp = hasMetaConfig;

    if (!title.trim() || !messageTemplate.trim()) {
      return e.json(400, { message: "Title and Message fields are required" });
    }

    const merchant = $app.findRecordById("merchants", merchantId);
    const merchantName = merchant.getString("name");

    // Fetch loyalty cards pointing to the merchant's programs where opt_in_marketing = true
    const programs = $app.findRecordsByFilter("loyalty_programs", `merchant = "${merchantId}"`);
    const programIds = programs.map(p => p.id);

    const customerIds = new Set();
    const optedOutIds = new Set();
    const customerRecords = [];

    if (programIds.length > 0) {
      // 1. Fetch all cards for the merchant's programs to distinguish opted-in and opted-out customers
      const programFilter = "(" + programIds.map(pid => `program = "${pid}"`).join(" || ") + ")";
      const cards = fetchAllRecords("loyalty_cards", programFilter, "-created");
      for (let i = 0; i < cards.length; i++) {
        const customerId = cards[i].get("customer");
        if (!customerId) continue;

        const optIn = cards[i].get("opt_in_marketing");
        if (optIn === false) {
          optedOutIds.add(customerId);
        } else {
          // If filtering by specific target customers
          if (targetCustomerIds && targetCustomerIds.indexOf(customerId) === -1) {
            continue;
          }

          if (!customerIds.has(customerId)) {
            customerIds.add(customerId);
            try {
              const cust = $app.findRecordById("users", customerId);
              customerRecords.push({
                record: cust,
                stamps: cards[i].get("stamps_collected") || 0
              });
            } catch (_) {}
          }
        }
      }
    }

    // 2. Also scan transactions to include customers who transacted but might not have active cards (defaulting stamps to 0),
    // making sure we respect the explicit opt-out of customers who have cards where opt_in_marketing is false
    const txs = fetchAllRecords("transactions", `merchant = "${merchantId}"`, "-created");
    for (let i = 0; i < txs.length; i++) {
      const customerId = txs[i].get("customer");
      if (customerId && !customerIds.has(customerId) && !optedOutIds.has(customerId)) {
        // If filtering by specific target customers
        if (targetCustomerIds && targetCustomerIds.indexOf(customerId) === -1) {
          continue;
        }

        customerIds.add(customerId);
        try {
          const cust = $app.findRecordById("users", customerId);
          customerRecords.push({
            record: cust,
            stamps: 0
          });
        } catch (_) {}
      }
    }

    if (customerRecords.length === 0) {
      return e.json(200, { success: true, count: 0, message: "No customers found to receive broadcasts." });
    }

    // Anti-spam: check if this merchant already sent a broadcast within the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const cooldownStr = oneDayAgo.toISOString().replace('T', ' ').substring(0, 19);

    const recentBroadcasts = fetchAllRecords(
      "broadcasts",
      `created >= "${cooldownStr}" && merchant = "${merchantId}"`,
      "-created"
    );
    if (recentBroadcasts.length > 0) {
      return e.json(429, {
        message: "You have already sent a broadcast in the last 24 hours. Please wait before sending another broadcast to protect customer experience."
      });
    }

    let sentCount = 0;
    const nameSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = `merchant-${merchantId}-${nameSlug}`;

    for (let i = 0; i < customerRecords.length; i++) {
      const customerItem = customerRecords[i];
      const customer = customerItem.record;
      const customerId = customer.id;
      const phone = customer.get("phone") || "";
      const customerName = customer.getString("name") || "Valued Customer";
      const customerStamps = customerItem.stamps;

      // Personalize the message content
      let personalizedMsg = messageTemplate
        .replace(/\{\{\s*name\s*\}\}/g, customerName)
        .replace(/\{\{\s*stamps\s*\}\}/g, String(customerStamps));

      // Format a beautiful, branded business message for WhatsApp
      const formattedWhatsAppMsg = `💌 *Hebahan Eksklusif daripada ${merchantName}*\n\n📣 *${title}*\n───────────────────\n${personalizedMsg}\n───────────────────\n\n_Untuk mengurus notifikasi, kemas kini Tetapan Profil di Aplikasi RISEV._`;

      // A. Create In-App Notification
      createNotification(
        customerId,
        title,
        personalizedMsg,
        "campaign",
        { merchant_id: merchantId, campaign_id: campaignId }
      );

      // B. Send Push Notification
      sendPushNotification(customerId, title, personalizedMsg, {
        type: "campaign",
        merchantId: merchantId,
        campaignId: campaignId
      });

      // C. Send WhatsApp Message (Meta Cloud API using risev_campaign template)
      if (sendWhatsApp && phone) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone) {
          try {
            sendTemplateMessage(
              merchantId,
              cleanPhone,
              "risev_campaign",
              "en_US",
              [merchantName, title, personalizedMsg]
            );
          } catch (whatsappErr) {
            console.log(`WhatsApp blast error for ${cleanPhone}:`, whatsappErr.message || whatsappErr);
          }
        }
      }
 
      sentCount++;
    }

    // 4. Log broadcast history in collection
    const broadcastCol = $app.findCollectionByNameOrId("broadcasts");
    const bcRecord = new Record(broadcastCol);
    
    // Generate a random 15-char lowercase alphanumeric ID to satisfy pocketbase validation
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomId = '';
    for (let i = 0; i < 15; i++) {
      randomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    bcRecord.set("id", randomId);

    bcRecord.set("merchant", merchantId);
    bcRecord.set("title", title);
    bcRecord.set("message", messageTemplate);
    if (campaignId) bcRecord.set("campaign", campaignId);
    bcRecord.set("recipients_count", sentCount);
    $app.save(bcRecord);

    return e.json(200, { success: true, count: sentCount });
  } catch (err) {
    return e.json(500, { message: "Failed to execute message blast: " + err.message });
  }
}, $apis.requireAuth("users"));

// 4. GET WhatsApp Webhook Challenge Verification
routerAdd("GET", "/api/risev/whatsapp-webhook", (e) => {
  const query = e.requestInfo().query || {};
  const mode = query["hub.mode"] || "";
  const token = query["hub.verify_token"] || "";
  const challenge = query["hub.challenge"] || "";

  const expectedVerifyToken = $os.getenv("META_WEBHOOK_VERIFY_TOKEN") || "risev_webhook_secret_2026";

  if (mode === "subscribe" && token === expectedVerifyToken) {
    console.log("[WEBHOOK VERIFICATION] Successfully verified Meta webhook subscription.");
    // Return the challenge as raw text to pass Meta verification
    return e.string(200, challenge);
  }

  console.log(`[WEBHOOK VERIFICATION FAILED] Mode: ${mode} | Token: ${token}`);
  return e.string(403, "Verification failed");
});

// 5. POST WhatsApp Webhook Listener (captures STOP opt-outs & inbound QR stamps) - STUBBED
routerAdd("POST", "/api/risev/whatsapp-webhook", (e) => {
  return e.json(200, { success: true, message: "Webhook decommissioned" });
});

// 5. GET Test WhatsApp Send (Temporary Route)
routerAdd("GET", "/api/risev/test/send-whatsapp", (e) => {
  const { sendTemplateMessage } = require(`${__hooks}/whatsapp_helper.js`);
  try {
    const phone = e.requestInfo().query.phone;
    if (!phone) {
      return e.string(400, "Missing phone parameter. Usage: ?phone=+60123456789");
    }

    const configs = $app.findRecordsByFilter(
      "whatsapp_configurations",
      "status = 'connected'",
      "-created",
      1,
      0
    );
    if (configs.length === 0) {
      return e.string(404, "No connected WhatsApp configuration found");
    }

    const merchantId = configs[0].get("merchant");
    const result = sendTemplateMessage(merchantId, phone, "hello_world", "en_US", []);

    return e.json(200, JSON.stringify(result, null, 2));
  } catch (err) {
    return e.json(500, { error: err.message || err });
  }
});
