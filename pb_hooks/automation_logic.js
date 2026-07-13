// pb_hooks/automation_logic.js

function runAutomations() {
  const stats = [];
  const rules = $app.findRecordsByFilter("automation_rules", "is_active = true", "-created", 100, 0);
  if (rules.length === 0) return stats;

  const { evolutionUrl, evolutionKey } = require(`${__hooks}/whatsapp_helper.js`);
  const { createNotification } = require(`${__hooks}/notification_helper.js`);
  const { sendPushNotification } = require(`${__hooks}/push_notify.js`);

  const now = new Date();

  for (let r = 0; r < rules.length; r++) {
    const rule = rules[r];
    const merchantId = rule.get("merchant");
    const triggerDays = rule.get("trigger_days");
    const title = rule.get("title");
    const messageTemplate = rule.get("message");
    const sendWhatsApp = !!rule.get("send_whatsapp");

    // Calculate target date strings for inactivity
    const targetStart = new Date();
    targetStart.setDate(now.getDate() - triggerDays);
    targetStart.setHours(0, 0, 0, 0);

    const targetEnd = new Date();
    targetEnd.setDate(now.getDate() - triggerDays);
    targetEnd.setHours(23, 59, 59, 999);

    const startStr = targetStart.toISOString().replace('T', ' ').substring(0, 19);
    const endStr = targetEnd.toISOString().replace('T', ' ').substring(0, 19);

    const merchant = $app.findRecordById("merchants", merchantId);
    const merchantName = merchant.getString("name");
    const nameSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = `merchant-${merchantId}-${nameSlug}`;

    // Get programs for this merchant
    const programs = $app.findRecordsByFilter("loyalty_programs", `merchant = "${merchantId}"`);
    const programIds = programs.map(p => p.id);
    if (programIds.length === 0) continue;

    const programFilter = "(" + programIds.map(pid => `program = "${pid}"`).join(" || ") + ")";
    const filter = `${programFilter} && updated >= "${startStr}" && updated <= "${endStr}" && (opt_in_marketing != false || opt_in_marketing = null)`;
    
    const cards = $app.findRecordsByFilter("loyalty_cards", filter, "-created", 1000, 0);
    if (cards.length === 0) continue;

    let sentCount = 0;
    const ruleStats = { ruleName: rule.get("name"), recipients: [] };

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const customerId = card.get("customer");
      const stampsCount = card.get("stamps_collected") || 0;

      // Anti-spam validation: Check if customer already received an automated message from this merchant in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      const limitStr = sevenDaysAgo.toISOString().replace('T', ' ').substring(0, 19);
      
      const recentNotifs = $app.findRecordsByFilter(
        "notifications",
        `customer = "${customerId}" && created >= "${limitStr}" && type = "campaign" && metadata ~ "${merchantId}"`,
        "-created",
        10,
        0
      );

      if (recentNotifs.length > 0) {
        // Already received a campaign notification recently - skip to avoid spam!
        continue;
      }

      // Fetch customer record
      let customer;
      try {
        customer = $app.findRecordById("users", customerId);
      } catch (_) {
        continue;
      }

      const phone = customer.get("phone") || "";
      const customerName = customer.getString("name") || "Valued Customer";

      // Personalize message
      let personalizedMsg = messageTemplate
        .replace(/\{\{\s*name\s*\}\}/g, customerName)
        .replace(/\{\{\s*stamps\s*\}\}/g, String(stampsCount));

      const formattedWhatsAppMsg = `💌 *Susulan Automatik daripada ${merchantName}*\n\n📣 *${title}*\n───────────────────\n${personalizedMsg}\n───────────────────\n\n⚠️ *Peringatan:* Mohon jangan laporkan (report) mesej ini sebagai spam.\n\n_Balas STOP untuk berhenti melanggan notifikasi._`;

      // A. Create In-App Notification
      createNotification(
        customerId,
        title,
        personalizedMsg,
        "campaign",
        { merchant_id: merchantId, automated: true }
      );

      // B. Send Push Notification
      sendPushNotification(customerId, title, personalizedMsg, {
        type: "campaign",
        merchantId: merchantId,
        automated: "true"
      });

      // C. Send WhatsApp
      if (sendWhatsApp && phone) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        if (cleanPhone) {
          try {
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
            console.log(`Automated WhatsApp error for ${cleanPhone}:`, whatsappErr.message || whatsappErr);
          }
        }
      }

      sentCount++;
      ruleStats.recipients.push(customerName);
    }

    if (sentCount > 0) {
      // Log automated broadcast in history
      const broadcastCol = $app.findCollectionByNameOrId("broadcasts");
      const bcRecord = new Record(broadcastCol);
      
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let randomId = '';
      for (let i = 0; i < 15; i++) {
        randomId += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      bcRecord.set("id", randomId);
      bcRecord.set("merchant", merchantId);
      bcRecord.set("title", `[Automated] ${rule.get("name")}`);
      bcRecord.set("message", messageTemplate);
      bcRecord.set("recipients_count", sentCount);
      $app.save(bcRecord);
    }
    stats.push(ruleStats);
  }
  return stats;
}

module.exports = {
  runAutomations
};
