// pb_hooks/blast_message.pb.js

// 1. GET WhatsApp Connection Status & Pairing QR Code
routerAdd("GET", "/api/risev/merchant/whatsapp/status", (e) => {
  return e.json(200, { status: "disconnected" });
}, $apis.requireAuth("users"));

// 1b. POST Pair WhatsApp with phone number (pairing code — no QR needed)
routerAdd("POST", "/api/risev/merchant/whatsapp/pair", (e) => {
  return e.json(400, { message: "WhatsApp service has been decommissioned." });
}, $apis.requireAuth("users"));

// 2. POST Disconnect & Delete WhatsApp Instance
routerAdd("POST", "/api/risev/merchant/whatsapp/disconnect", (e) => {
  return e.json(200, { success: true });
}, $apis.requireAuth("users"));

// 2b. GET WhatsApp Business Message Templates (from Meta Cloud API)
routerAdd("GET", "/api/risev/merchant/whatsapp/templates", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized" });
    }
    const merchantId = authRecord.get("merchant_id");
    if (!merchantId) {
      return e.json(400, { message: "No merchant profile linked" });
    }

    // 1. Fetch credentials
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

    // 2. If no config, return dummy templates for testing/onboarding
    if (!config) {
      return e.json(200, {
        templates: [
          {
            name: "winback_7day_mock",
            status: "APPROVED",
            category: "MARKETING",
            language: "en_US",
            components: [
              { type: "BODY", text: "We miss you, {{1}}! Come back to {{2}} to collect more stamps." }
            ]
          },
          {
            name: "visit_thank_you_mock",
            status: "APPROVED",
            category: "UTILITY",
            language: "en_US",
            components: [
              { type: "BODY", text: "Hi {{1}}, thanks for visiting {{2}}! You collected {{3}} stamps today." }
            ]
          }
        ],
        sandbox: true
      });
    }

    const wabaId = config.getString("waba_id");
    const accessToken = config.getString("access_token");

    // 3. Request templates from Meta
    const res = $http.send({
      url: `https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      const resData = JSON.parse(res.raw);
      // Filter out templates that are not APPROVED or are rejected
      const templates = (resData.data || [])
        .filter(t => t.status === "APPROVED")
        .map(t => ({
          name: t.name,
          status: t.status,
          category: t.category,
          language: t.language,
          components: t.components
        }));

      return e.json(200, { templates, sandbox: false });
    } else {
      console.log(`[META TEMPLATE ERROR] Status: ${res.statusCode} | Raw: ${res.raw}`);
      return e.json(res.statusCode, { message: "Failed to fetch templates from Meta", error: res.raw });
    }
  } catch (err) {
    console.log(`[META TEMPLATE EXCEPTION]`, err.message || err);
    return e.json(500, { message: err.message || err });
  }
}, $apis.requireAuth("users"));

// 2c. GET Meta OAuth Callback Endpoint
routerAdd("GET", "/api/risev/merchant/whatsapp/callback", (e) => {
  try {
    const code = e.request.queryParam("code");
    const stateStr = e.request.queryParam("state");

    if (!code || !stateStr) {
      return e.string(400, "Missing OAuth code or state parameter.");
    }

    // 1. Decode state JSON
    let merchantId = "";
    let redirectHost = "https://waly-five.vercel.app"; // default fallback
    try {
      const decodedState = JSON.parse(decodeURIComponent(stateStr));
      merchantId = decodedState.merchantId;
      if (decodedState.redirectHost) {
        redirectHost = decodedState.redirectHost;
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
    const callbackUrl = `${redirectHost}/api/risev/merchant/whatsapp/callback`; // must match OAuth settings

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

    // 4. Fetch WhatsApp Business Account (WABA) details
    // We fetch the accounts linked to this login token
    const accountsRes = $http.send({
      url: `https://graph.facebook.com/v20.0/me/whatsapp_business_accounts`,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${userAccessToken}`
      }
    });

    if (accountsRes.statusCode < 200 || accountsRes.statusCode >= 300) {
      console.log(`[META OAUTH ERROR] Failed to fetch accounts: ${accountsRes.raw}`);
      return e.string(accountsRes.statusCode, `Failed to fetch accounts from Meta: ${accountsRes.raw}`);
    }

    const accountsData = JSON.parse(accountsRes.raw);
    const accounts = accountsData.data || [];
    if (accounts.length === 0) {
      return e.string(400, "No WhatsApp Business Accounts found linked to your Facebook account.");
    }

    // Use the first active WABA
    const activeWaba = accounts[0];
    const wabaId = activeWaba.id;

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
      record.set("merchant", merchantId);
      record.set("waba_id", wabaId);
      record.set("phone_number_id", phoneNumberId);
      record.set("access_token", userAccessToken);
      record.set("phone_number", verifiedPhone);
      record.set("status", "connected");
      $app.save(record);
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

// 3. POST Blast Message to Customers
routerAdd("POST", "/api/risev/merchant/blast", (e) => {
  const { sendTextMessage, fetchAllRecords } = require(`${__hooks}/whatsapp_helper.js`);
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
    const sendWhatsApp = false; // WhatsApp service decommissioned

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

    // Anti-spam: build a Set of customer IDs who received a campaign notification
    // from this merchant in the last 24 hours. Skip them in the send loop.
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const cooldownStr = oneDayAgo.toISOString().replace('T', ' ').substring(0, 19);

    const recentNotifs = fetchAllRecords(
      "broadcasts",
      `created >= "${cooldownStr}" && merchant = "${merchantId}"`,
      "-created"
    );
    const recentlyNotifiedIds = new Set();
    for (let n = 0; n < recentNotifs.length; n++) {
      const r = recentNotifs[n].get("merchant");
      if (r) recentlyNotifiedIds.add(r);
    }

    let sentCount = 0;
    const nameSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = `merchant-${merchantId}-${nameSlug}`;

    for (let i = 0; i < customerRecords.length; i++) {
      const customerItem = customerRecords[i];
      const customer = customerItem.record;
      const customerId = customer.id;

      // Anti-spam: skip customers notified in the last 24h
      if (recentlyNotifiedIds.has(customerId)) continue;
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

      // C. Send WhatsApp Message
      if (sendWhatsApp && phone) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone) {
          try {
            // 1. Spaced out delay: 20 seconds base interval, plus 0 to 10 seconds random variance
            const baseInterval = 20000; // 20 seconds
            const randomVariance = Math.floor(Math.random() * 10000); // 0-10 seconds
            const typingDelay = 5000; // 5 seconds typing status

            // 2. Sleep Time: Add 10 minutes of pause after every 50 messages
            const batchSize = 50;
            const sleepDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
            const batchCount = Math.floor(i / batchSize);
            const totalSleepTime = batchCount * sleepDuration;

            // 3. Final calculated queue delay
            const queueDelay = (i * baseInterval) + randomVariance + typingDelay + totalSleepTime;

            sendTextMessage(instanceName, cleanPhone, formattedWhatsAppMsg, {
              delay: queueDelay,
              presence: 'composing'
            });
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

// 4. POST WhatsApp Webhook Listener (captures STOP opt-outs & inbound QR stamps) - STUBBED
routerAdd("POST", "/api/risev/whatsapp-webhook", (e) => {
  return e.json(200, { success: true, message: "Webhook decommissioned" });
});
