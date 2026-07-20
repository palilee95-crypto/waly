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

    // A. Check connection state by fetching all instances
    let fetchRes = callEvo("GET", `/instance/fetchInstances`);
    let instanceInfo = null;
    if (fetchRes.status === 200 && Array.isArray(fetchRes.data)) {
      instanceInfo = fetchRes.data.find(inst => inst.name === instanceName);
    }

    const generateQr = e.requestInfo().query.generateQr === 'true';

    // If instance doesn't exist
    if (!instanceInfo) {
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

      if (createRes.status === 403) {
        // Self-healing: If instance exists but is corrupted/hidden, delete it and recreate it!
        callEvo("DELETE", `/instance/delete/${instanceName}`);
        const retryRes = callEvo("POST", "/instance/create", {
          instanceName: instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        });
        if (retryRes.status >= 400) {
          return e.json(retryRes.status, { message: "Failed to recreate WhatsApp instance", error: retryRes.data });
        }
        const qrBase64 = retryRes.data?.qrcode?.base64 || "";
        return e.json(200, {
          status: "disconnected",
          qrcode: qrBase64
        });
      }

      if (createRes.status >= 400) {
        return e.json(createRes.status, { message: "Failed to create WhatsApp instance", error: createRes.data });
      }

      const qrBase64 = createRes.data?.qrcode?.base64 || "";
      return e.json(200, {
        status: "disconnected",
        qrcode: qrBase64
      });
    }

    const state = instanceInfo.connectionStatus || "close";

    if (state === "open") {
      const ownerJid = instanceInfo.ownerJid || "";
      const phoneNum = ownerJid ? ownerJid.split("@")[0] : "";
      return e.json(200, {
        status: "connected",
        phone: phoneNum ? "+" + phoneNum : ""
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

// 1b. POST Pair WhatsApp with phone number (pairing code — no QR needed)
routerAdd("POST", "/api/risev/merchant/whatsapp/pair", (e) => {
  const { callEvo, pairInstance, getInstanceToken, evolutionUrl } = require(`${__hooks}/whatsapp_helper.js`);
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

    const body = e.requestInfo().body || {};
    const phone = (body.phone || "").trim();
    if (!phone) {
      return e.json(400, { message: "Phone number is required" });
    }

    const merchant = $app.findRecordById("merchants", merchantId);
    const merchantName = merchant.getString("name") || "";
    const nameSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = `merchant-${merchantId}-${nameSlug}`;

    // Ensure instance exists first and is started
    let fetchRes = callEvo("GET", `/instance/fetchInstances`);
    let instanceInfo = null;
    if (fetchRes.status === 200 && Array.isArray(fetchRes.data)) {
      instanceInfo = fetchRes.data.find(inst => inst.name === instanceName);
    }

    if (!instanceInfo) {
      // Create instance without QR (we'll pair via phone)
      callEvo("POST", "/instance/create", {
        instanceName: instanceName,
        qrcode: false,
        integration: "WHATSAPP-BAILEYS"
      });
      // Give a brief moment for creation to settle
      $os.sleep && $os.sleep(1000);
    }

    const token = getInstanceToken(instanceName);
    if (!token) {
      throw new Error(`Instance token not found for ${instanceName}`);
    }

    // Refresh instance info to check status
    fetchRes = callEvo("GET", `/instance/fetchInstances`);
    if (fetchRes.status === 200 && Array.isArray(fetchRes.data)) {
      instanceInfo = fetchRes.data.find(inst => inst.name === instanceName);
    }

    const connectionStatus = instanceInfo ? (instanceInfo.connectionStatus || instanceInfo.status || "close") : "close";
    if (connectionStatus !== "open" && connectionStatus !== "ON" && connectionStatus !== "connecting") {
      $http.send({
        url: `${evolutionUrl}/instance/connect`,
        method: 'POST',
        headers: {
          "apikey": token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });
      // Give Evolution Go a brief moment to spin up the connection
      $os.sleep && $os.sleep(1000);
    }

    const result = pairInstance(instanceName, phone);
    console.log("Merchant WhatsApp pair raw result:", JSON.stringify(result));

    const dataObj = result.data || result || {};
    const finalCode = dataObj.PairingCode || 
                      dataObj.pairingCode || 
                      dataObj.code || 
                      dataObj.pairing_code || 
                      dataObj.pairCode || 
                      dataObj.pair_code || 
                      "Check your WhatsApp";

    return e.json(200, {
      success: true,
      pairingCode: finalCode,
      raw: result
    });
  } catch (err) {
    const errMsg = err.message || err.toString() || "";
    if (errMsg.indexOf("rate-overlimit") !== -1) {
      return e.json(429, { 
        message: "WhatsApp rate-limit exceeded: Too many pairing requests for this phone number. Please wait 20-30 minutes, try a different number, or link via QR code instead. / Had WhatsApp melebihi had: Sila tunggu 20-30 minit, gunakan nombor lain, atau pautkan melalui QR." 
      });
    }
    return e.json(500, { message: "Failed to generate pairing code: " + errMsg });
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

    // ── Inbound QR Transaction Processing ──────────────────────────
    // Check if the message contains a TxID (QR transaction code)
    if (messageText && cleanPhone) {
      try {
        const txMatch = messageText.match(/TxID:\s*([A-Z0-9]+)/i);
        if (txMatch && txMatch[1]) {
          const txCode = txMatch[1].toUpperCase();
          // Accept status = sent OR status = pending (in case mark-sent request was delayed or skipped)
          const txs = $app.findRecordsByFilter("qr_transactions",
            `tx_code = "${txCode}" && (status = "sent" || status = "pending")`,
            "created", 1, 0);

          if (txs.length > 0) {
            const tx = txs[0];
            const merchantId = tx.getString("merchant");
            const stampAmount = parseInt(tx.get("stamp_amount")) || 0;
            const billAmount = parseFloat(tx.get("bill_amount")) || 0;

            // 1. Try to fetch pre-linked customer record from qr_transaction
            let customer = null;
            const prelinkedCustomerId = tx.getString("customer");
            if (prelinkedCustomerId) {
              try {
                customer = $app.findRecordById("users", prelinkedCustomerId);
              } catch (err) { /* fallback */ }
            }

            // 2. Fall back to phone search (normalize phone digits, search by last 8 digits)
            if (!customer && cleanPhone) {
              const digitsOnly = cleanPhone.replace(/[^\d]/g, '');
              const last8 = digitsOnly.slice(-8);
              if (last8) {
                try {
                  const users = $app.findRecordsByFilter("users",
                    `phone LIKE "%${last8}%"`,
                    "created", 1, 0);
                  if (users.length > 0) customer = users[0];
                } catch (err) { /* not found */ }
              }
            }

            // Find merchant's loyalty program
            const programs = $app.findRecordsByFilter("loyalty_programs",
              `merchant = "${merchantId}"`, "created", 1, 0);

            if (programs.length > 0 && customer) {
              const program = programs[0];
              const programId = program.id;
              const goal = parseInt(program.get("stamp_goal")) || 10;

              // Find or create loyalty card
              let card = null;
              try {
                const cards = $app.findRecordsByFilter("loyalty_cards",
                  `program = "${programId}" && customer = "${customer.id}"`,
                  "created", 1, 0);
                if (cards.length > 0) card = cards[0];
              } catch (err) { /* no card yet */ }

              if (!card) {
                const cardCol = $app.findCollectionByNameOrId("loyalty_cards");
                card = new Record(cardCol, {
                  program: programId,
                  customer: customer.id,
                  merchant: merchantId,
                  stamps_collected: 0,
                  status: "active",
                  opt_in_marketing: true,
                });
                $app.save(card);
              }

              const currentStamps = parseInt(card.get("stamps_collected")) || 0;
              const totalStamps = currentStamps + stampAmount;

              // Update card stamps & activity
              card.set("stamps_collected", totalStamps);
              card.set("last_activity", new Date().toISOString());
              $app.save(card);

              // Create transaction record
              try {
                const txnCol = $app.findCollectionByNameOrId("transactions");
                const txn = new Record(txnCol, {
                  loyalty_card: card.id,
                  type: "earn",
                  stamps: stampAmount,
                  bill_amount: billAmount,
                  customer: customer.id,
                  merchant: merchantId,
                  metadata: { source: "qr_inbound", tx_code: txCode },
                });
                $app.save(txn);
              } catch (txnErr) {
                console.log("Failed to create transaction record:", txnErr.message || txnErr);
              }

              // Mark QR transaction as completed & update customer link
              tx.set("status", "completed");
              tx.set("customer", customer.id);
              tx.set("completed_at", new Date().toISOString());
              $app.save(tx);

              // Build auto-reply message reflecting goal & reward state
              const customerName = customer.getString("name") || "there";
              const instanceName = body.instanceName || "";
              const { sendTextMessage } = require(`${__hooks}/whatsapp_helper.js`);

              let replyMsg = "";
              if (totalStamps >= goal) {
                const remaining = totalStamps % goal;
                replyMsg = `Hi ${customerName}! 🎉 You earned ${stampAmount} stamps and completed your card! A reward voucher has been added to your account. Your new balance: ${remaining} stamp(s). Thank you for visiting!`;
              } else {
                replyMsg = `Hi ${customerName}! ${stampAmount} stamp(s) added! You now have ${totalStamps} / ${goal} stamps. Thank you for visiting!`;
              }

              try {
                sendTextMessage(
                  instanceName,
                  cleanPhone,
                  replyMsg,
                  { delay: 1000, presence: 'composing' }
                );
              } catch (replyErr) {
                console.log("Auto-reply failed:", replyErr.message || replyErr);
              }

              console.log(`QR inbound: ${stampAmount} stamps added for ${customerName} (tx: ${txCode})`);
              return e.json(200, { success: true, processed: "qr_stamp" });
            }
          }
        }
      } catch (qrErr) {
        console.log("QR inbound processing error:", qrErr.message || qrErr);
      }
    }

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
