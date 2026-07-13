// pb_hooks/blast_message.pb.js

// 1. GET WhatsApp Connection Status & Pairing QR Code
routerAdd("GET", "/api/risev/merchant/whatsapp/status", (e) => {
  const { callEvo } = require(`${__hooks}/whatsapp_helper.js`);
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

    const merchant = $app.findRecordById("merchants", merchantId);
    const merchantName = merchant.getString("name") || "";
    const nameSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = `merchant-${merchantId}-${nameSlug}`;

    // A. Check connection state
    let stateRes = callEvo("GET", `/instance/connectionState/${instanceName}`);

    const generateQr = e.requestInfo().query.generateQr === 'true';

    // If instance doesn't exist
    if (stateRes.status === 404 || (stateRes.data && (stateRes.data.status === 404 || stateRes.data.status === 'error'))) {
      if (!generateQr) {
        return e.json(200, {
          status: "disconnected"
        });
      }

      const createRes = callEvo("POST", "/instance/create", {
        instanceName: instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      });

      if (createRes.status >= 400) {
        return e.json(createRes.status, { message: "Failed to create WhatsApp instance", error: createRes.data });
      }

      const qrBase64 = createRes.data?.qrcode?.base64 || "";
      return e.json(200, {
        status: "disconnected",
        qrcode: qrBase64
      });
    }

    const state = stateRes.data?.instance?.state || "close";

    if (state === "open") {
      return e.json(200, {
        status: "connected"
      });
    } else {
      // Instance exists but is closed
      if (!generateQr) {
        return e.json(200, {
          status: "disconnected"
        });
      }

      const connectRes = callEvo("GET", `/instance/connect/${instanceName}`);
      const qrBase64 = connectRes.data?.base64 || connectRes.data?.qrcode?.base64 || "";
      return e.json(200, {
        status: "disconnected",
        qrcode: qrBase64
      });
    }
  } catch (err) {
    return e.json(500, { message: "Internal server error: " + err.message });
  }
}, $apis.requireAuth("users"));

// 2. POST Disconnect & Delete WhatsApp Instance
routerAdd("POST", "/api/risev/merchant/whatsapp/disconnect", (e) => {
  const { callEvo } = require(`${__hooks}/whatsapp_helper.js`);
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

    const merchant = $app.findRecordById("merchants", merchantId);
    const merchantName = merchant.getString("name") || "";
    const nameSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = `merchant-${merchantId}-${nameSlug}`;

    callEvo("DELETE", `/instance/delete/${instanceName}`);

    return e.json(200, { success: true });
  } catch (err) {
    return e.json(500, { message: "Internal server error: " + err.message });
  }
}, $apis.requireAuth("users"));

// 3. POST Blast Message to Customers
routerAdd("POST", "/api/risev/merchant/blast", (e) => {
  const { evolutionUrl, evolutionKey } = require(`${__hooks}/whatsapp_helper.js`);
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
    const sendWhatsApp = !!body.sendWhatsApp;

    if (!title.trim() || !messageTemplate.trim()) {
      return e.json(400, { message: "Title and Message fields are required" });
    }

    const merchant = $app.findRecordById("merchants", merchantId);
    const merchantName = merchant.getString("name");

    // Fetch loyalty cards pointing to the merchant's programs where opt_in_marketing = true
    const programs = $app.findRecordsByFilter("loyalty_programs", `merchant = "${merchantId}"`);
    const programIds = programs.map(p => p.id);

    const customerIds = new Set();
    const customerRecords = [];

    if (programIds.length > 0) {
      const filter = "(" + programIds.map(pid => `program = "${pid}"`).join(" || ") + ") && (opt_in_marketing != false || opt_in_marketing = null)";
      const cards = $app.findRecordsByFilter("loyalty_cards", filter, "-created", 1000, 0);
      for (let i = 0; i < cards.length; i++) {
        const customerId = cards[i].get("customer");
        if (customerId && !customerIds.has(customerId)) {
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

    // Also scan transactions to include customers who transacted but might not have active cards (defaulting stamps to 0)
    const txs = $app.findRecordsByFilter("transactions", `merchant = "${merchantId}"`, "-created", 1000, 0);
    for (let i = 0; i < txs.length; i++) {
      const customerId = txs[i].get("customer");
      if (customerId && !customerIds.has(customerId)) {
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

    // Load helper functions
    const { createNotification } = require(`${__hooks}/notification_helper.js`);
    const { sendPushNotification } = require(`${__hooks}/push_notify.js`);

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
      const formattedWhatsAppMsg = `💌 *Hebahan Eksklusif daripada ${merchantName}*\n\n📣 *${title}*\n───────────────────\n${personalizedMsg}\n───────────────────\n\n⚠️ *Peringatan:* Mohon jangan laporkan (report) mesej ini sebagai spam.\n\n_Untuk mengurus notifikasi, kemas kini Tetapan Profil di Aplikasi RISEV._`;

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
            // Calculate a randomized delay to simulate human typing in the queue
            const randomDelay = Math.floor(Math.random() * 4000) + 5000; // 5s to 9s

            $http.send({
              url: `${evolutionUrl}/message/sendText/${instanceName}`,
              method: 'POST',
              headers: {
                'apikey': evolutionKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: cleanPhone,
                text: formattedWhatsAppMsg,
                options: {
                  delay: randomDelay,
                  presence: 'composing'
                }
              }),
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

// 4. POST WhatsApp Webhook Listener (captures STOP opt-outs)
routerAdd("POST", "/api/risev/whatsapp-webhook", (e) => {
  try {
    const body = e.requestInfo().body;
    const event = body.event;
    if (event !== "messages.upsert") {
      return e.json(200, { success: true, message: "Ignored event" });
    }

    const data = body.data;
    if (!data || data.key?.fromMe) {
      return e.json(200, { success: true });
    }

    const remoteJid = data.key?.remoteJid || "";
    const cleanPhone = remoteJid.split("@")[0];
    
    // Safely extract message text
    let messageText = "";
    if (data.message) {
      messageText = data.message.conversation || "";
      if (!messageText && data.message.extendedTextMessage) {
        messageText = data.message.extendedTextMessage.text || "";
      }
    }
    const textMsg = messageText.trim().toUpperCase();

    if (textMsg === "STOP" && cleanPhone) {
      // Find user by phone number
      const users = $app.findRecordsByFilter("users", `phone LIKE "%${cleanPhone}%"`, "-created", 1, 0);
      if (users.length > 0) {
        const userId = users[0].id;
        
        // Extract merchantId from the instanceName (e.g. "merchant-g9tni0awp7jynnl-slug")
        const instanceName = body.instanceName || "";
        const parts = instanceName.split("-");
        if (parts.length >= 2) {
          const merchantId = parts[1];

          // Set opt_in_marketing = false on customer's cards for this merchant
          const programs = $app.findRecordsByFilter("loyalty_programs", `merchant = "${merchantId}"`);
          const programIds = programs.map(p => p.id);
          
          if (programIds.length > 0) {
            const cardFilter = "(" + programIds.map(pid => `program = "${pid}"`).join(" || ") + ") && customer = \"" + userId + "\"";
            const cards = $app.findRecordsByFilter("loyalty_cards", cardFilter);
            for (let i = 0; i < cards.length; i++) {
              cards[i].set("opt_in_marketing", false);
              $app.save(cards[i]);
            }
            console.log(`Unsubscribed customer ${userId} from merchant ${merchantId} alerts via STOP text.`);
          }
        }
      }
    }
    return e.json(200, { success: true });
  } catch (err) {
    console.log("WhatsApp webhook opt-out listener error:", err.message || err);
    return e.json(500, { error: err.message });
  }
});
