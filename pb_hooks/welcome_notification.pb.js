onRecordAfterCreateSuccess((e) => {
  if (e.record.get('type') !== 'earn') return e.next();

  const customerId = e.record.get('customer');
  const merchantId = e.record.get('merchant');
  const stampsEarned = e.record.get('stamps') || 0;

  try {
    // 1. Fetch customer user details
    const customer = $app.findRecordById('users', customerId);
    const phone = customer.get('phone') || "";
    if (!phone) {
      return e.next();
    }

    // Clean the phone number (strip non-digits for API)
    const cleanPhone = phone.replace(/[^\d]/g, '');
    if (!cleanPhone) {
      return e.next();
    }

    const merchant = $app.findRecordById('merchants', merchantId);
    const merchantName = merchant.get('name') || "our shop";
    
    // Resolve merchant-specific WhatsApp instance name using slug logic
    const nameSlug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const instanceName = `merchant-${merchantId}-${nameSlug}`;

    // Load environment settings
    const evolutionUrl = $os.getenv('EVOLUTION_API_URL') || 'http://localhost:8080';
    const evolutionKey = $os.getenv('EVOLUTION_API_KEY') || 'risev_dev_api_key';
    const appUrl = $os.getenv('APP_URL') || 'https://waly-five.vercel.app/';

    // 2. Determine if customer is a brand new account
    // We check if the customer was created in the last 15 seconds
    const createdTime = new Date(customer.getString('created'));
    const now = new Date();
    const diffMs = now.getTime() - createdTime.getTime();

    let messageText = "";

    if (diffMs < 15000) {
      // BRAND NEW USER: Send welcome message via merchant WhatsApp instance
      console.log(`[WHATSAPP HOOK] New customer welcome notification to: ${phone} (via ${instanceName})`);
      const customerName = customer.getString('name') || "Customer";
      
      messageText = `🎁 *Selamat Datang ke ${merchantName}!* 🎁\n\nAkaun kad ganjaran digital anda telah diaktifkan untuk nombor: *${phone}*\n\nTahniah! Anda baru mendapat *${stampsEarned}* Cop (Stamp) di *${merchantName}*! 🎉\n\nUntuk melihat baki cop & menuntut hadiah percuma, sila log masuk di sini:\n🔗 ${appUrl}\n\n💬 Sila balas *OK* untuk mengesahkan penerimaan dan mengaktifkan notifikasi ganjaran anda!\n───────────────────\n⚠️ *Peringatan:* Mohon jangan laporkan (report) mesej ini sebagai spam. Anda boleh mematikan notifikasi WhatsApp di Profil anda.`;
    } else if (stampsEarned > 0) {
      // EXISTING USER: Send stamp update notification via merchant WhatsApp instance
      console.log(`[WHATSAPP HOOK] Stamp earned notification to: ${phone} (via ${instanceName})`);
      
      let currentStamps = 0;
      let goal = 10;
      try {
        const cardId = e.record.get('loyalty_card');
        if (cardId) {
          const card = $app.findRecordById('loyalty_cards', cardId);
          currentStamps = card.get('stamps_collected') || 0;
          const program = $app.findRecordById('loyalty_programs', card.get('program'));
          goal = program.get('stamp_goal') || 10;
        }
      } catch (cardErr) {
        console.log("[WHATSAPP HOOK] Error fetching card details:", cardErr.message || cardErr);
      }

      // Check if they completed the stamp card (reset to 0 and completions increased)
      const isCompleted = (currentStamps === 0 && stampsEarned > 0);

      if (isCompleted) {
        messageText = `🎉 *Tahniah! Anda Telah Melengkapkan Kad Cop!* 🎉\n\nTerima kasih kerana mengunjungi *${merchantName}*! Anda baru sahaja menerima *${stampsEarned}* Cop (Stamp) terakhir untuk melengkapkan kad anda.\n\n🎁 Ganjaran anda telah dimasukkan ke dalam akaun. Sila semak aplikasi untuk menebus hadiah anda!\n\nUntuk melihat ganjaran anda, layari:\n🔗 ${appUrl}\n───────────────────\n⚠️ *Peringatan:* Mohon jangan laporkan (report) mesej ini sebagai spam. Anda boleh mematikan notifikasi WhatsApp di Profil anda.`;
      } else {
        messageText = `✨ *Cop Baharu Diterima!* ✨\n\nTerima kasih kerana mengunjungi *${merchantName}*! Anda baru sahaja mendapat *${stampsEarned}* Cop (Stamp).\n\n📊 *Status Kad Cop Anda:*\n*${currentStamps} / ${goal}* Cop dipenuhi.\n\nKumpulkan *${goal - currentStamps}* cop lagi untuk menebus ganjaran! 🎁\n\nUntuk melihat kad ganjaran anda, layari:\n🔗 ${appUrl}\n───────────────────\n⚠️ *Peringatan:* Mohon jangan laporkan (report) mesej ini sebagai spam. Anda boleh mematikan notifikasi WhatsApp di Profil anda.`;
      }
    }

    if (messageText) {
      // Dispatch message via Evolution API using the merchant's WhatsApp instance
      $http.send({
        url: `${evolutionUrl}/message/sendText/${instanceName}`,
        method: 'POST',
        headers: {
          'apikey': evolutionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: messageText,
          options: {
            delay: 2000,
            presence: 'composing'
          }
        }),
      });
      
      console.log(`[WHATSAPP HOOK] Dispatched WhatsApp to ${cleanPhone} via ${instanceName}`);
    }
  } catch (err) {
    console.log("[WHATSAPP HOOK] WhatsApp notification error:", err.message || err);
  }

  return e.next();
}, 'transactions');
