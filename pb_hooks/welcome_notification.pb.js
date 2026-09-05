onRecordCreate((e) => {
  if (e.record.get('type') !== 'earn') return;

  const customerId = e.record.get('customer');
  const merchantId = e.record.get('merchant');
  const stampsEarned = e.record.get('stamps') || 0;

  try {
    const customer = $app.findRecordById('users', customerId);
    const merchant = $app.findRecordById('merchants', merchantId);
    const merchantName = merchant.get('name') || "our shop";
    
    const { createNotification } = require(`${__hooks}/notification_helper.js`);
    const { sendPushNotification } = require(`${__hooks}/push_notify.js`);
    const appUrl = $os.getenv('APP_URL') || 'https://risev.app/';

    // 2. Determine if customer is a brand new account (created in last 15 seconds)
    const createdTime = new Date(customer.getString('created'));
    const now = new Date();
    const diffMs = now.getTime() - createdTime.getTime();

    let messageTitle = "";
    let messageBody = "";

    let staffName = "";
    try {
      const rawMeta = e.record.get("metadata");
      let parsed = typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta;
      if (parsed && parsed.staff_name && parsed.staff_name !== "Merchant" && parsed.staff_name !== "Owner") {
        staffName = parsed.staff_name;
      }
    } catch (mErr) {}

    const staffText = staffName ? ` (Dilayan oleh ${staffName})` : "";

    if (diffMs < 15000) {
      // BRAND NEW USER: Send welcome notification
      messageTitle = `Selamat Datang ke ${merchantName}! 🎁`;
      messageBody = `Akaun kad ganjaran digital anda telah diaktifkan! Tahniah! Anda baru mendapat ${stampsEarned} Cop (Stamp) di ${merchantName}${staffText}! 🎉\n\nUntuk melihat baki cop & menuntut hadiah percuma, sila log masuk di sini:\n${appUrl}`;
    } else if (stampsEarned > 0) {
      // EXISTING USER: Send stamp update notification
      let currentStamps = 0;
      let goal = 10;
      let completions = 0;
      try {
        let cardId = e.record.get('loyalty_card');
        let card = null;
        if (cardId) {
          try { card = $app.findRecordById('loyalty_cards', cardId); } catch (cErr) {}
        }
        if (!card && customerId && merchantId) {
          try {
            const cards = $app.findRecordsByFilter('loyalty_cards', `merchant = '${merchantId}' && customer = '${customerId}'`, 'created', 1, 0);
            if (cards.length > 0) card = cards[0];
          } catch (cFilterErr) {}
        }

        if (card) {
          currentStamps = card.get('stamps_collected') || 0;
          completions = card.get('completions') || 0;
          const program = $app.findRecordById('loyalty_programs', card.get('program'));
          goal = program.get('stamp_goal') || 10;
        }
      } catch (cardErr) {
        console.log("[NOTIFICATION HOOK] Error fetching card details:", cardErr.message || cardErr);
      }

      // Check if card was completed (stamps_collected reset to 0 with completions > 0, OR currentStamps >= goal)
      const isCompleted = (currentStamps >= goal) || (currentStamps === 0 && completions > 0 && stampsEarned > 0);

      if (isCompleted) {
        messageTitle = `Tahniah! Anda Telah Melengkapkan Kad Cop! 🎉`;
        messageBody = `Terima kasih kerana mengunjungi ${merchantName}${staffText}! Anda baru sahaja menerima ${stampsEarned} Cop (Stamp) terakhir untuk melengkapkan kad anda.\n\nGanjaran anda telah dimasukkan ke dalam akaun. Sila semak aplikasi untuk menebus hadiah anda!\n\nUntuk melihat ganjaran anda, layari:\n${appUrl}`;
      } else {
        messageTitle = `Cop Baharu Diterima! ✨`;
        messageBody = `Terima kasih kerana mengunjungi ${merchantName}${staffText}! Anda baru sahaja mendapat ${stampsEarned} Cop (Stamp).\n\n📊 Status Kad Cop Anda:\n${currentStamps} / ${goal} Cop dipenuhi.\n\nKumpulkan ${Math.max(0, goal - currentStamps)} cop lagi untuk menebus ganjaran! 🎁\n\nUntuk melihat baki cop anda, layari:\n${appUrl}`;
      }
    }

    if (messageTitle && messageBody) {
      // 1. Create In-App Notification
      createNotification(customerId, messageTitle, messageBody, "stamp_update", { merchant_id: merchantId });
      
      // 2. Send Push Notification
      sendPushNotification(customerId, messageTitle, messageBody, {
        type: "stamp_update",
        merchantId: merchantId
      });
      console.log(`[NOTIFICATION HOOK] Sent Push & In-App stamp/welcome notification to customer ${customerId}`);
    }
  } catch (err) {
    console.log("[NOTIFICATION HOOK] Stamp notification error:", err.message || err);
  }
  return e.next();
}, 'transactions');
