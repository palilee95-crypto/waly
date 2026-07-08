onRecordAfterCreateSuccess((e) => {
  if (e.record.get('type') !== 'earn') return e.next();

  const customerId = e.record.get('customer');
  const merchantId = e.record.get('merchant');
  const stampsEarned = e.record.get('stamps') || 0;

  try {
    // 1. Fetch customer user details
    const customer = $app.findRecordById('users', customerId);
    
    // 2. Determine if customer is a brand new account
    // We check if the customer was created in the last 15 seconds
    const createdTime = new Date(customer.getString('created'));
    const now = new Date();
    const diffMs = now.getTime() - createdTime.getTime();
    
    // Only send the welcome message if the user record was just created (auto-onboarded)
    if (diffMs < 15000) {
      console.log(`[WELCOME HOOK] New customer detected for welcome notification: ${customer.get('phone')}`);
      
      const merchant = $app.findRecordById('merchants', merchantId);
      const merchantName = merchant.get('name') || "our shop";
      const phone = customer.get('phone') || "";
      const customerName = customer.getString('name') || "Customer";
      
      if (!phone) {
        return e.next();
      }

      // Clean the phone number (strip non-digits for API)
      const cleanPhone = phone.replace(/[^\d]/g, '');

      // Load environment settings
      const evolutionUrl = $os.getenv('EVOLUTION_API_URL') || 'http://localhost:8080';
      const evolutionKey = $os.getenv('EVOLUTION_API_KEY') || 'waly_dev_api_key';
      const appUrl = $os.getenv('APP_URL') || 'https://waly-five.vercel.app';

      // 3. Dispatch welcome message via Evolution API
      $http.send({
        url: `${evolutionUrl}/message/sendText/waly-instance`,
        method: 'POST',
        headers: {
          'apikey': evolutionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: `🎁 *Selamat Datang ke WALY, ${customerName}!* 🎁\n\nAkaun telah dicipta untuk nombor telefon anda: *${phone}*\n\nAnda baru sahaja menerima: *${stampsEarned}* Cop (Stamp) di *${merchantName}*! 🎉\n\nUntuk melihat kad cop anda, menuntut ganjaran, dan mengesahkan akaun anda, sila log masuk di sini:\n🔗 ${appUrl}\n\n⚠️ *Peringatan:* Mohon jangan laporkan (report) mesej ini sebagai spam.\n\nTerima kasih!`,
          options: {
            delay: 2000,
            presence: 'composing'
          }
        }),
      });
      
      console.log(`[WELCOME HOOK] Dispatched WhatsApp welcome to ${cleanPhone}`);
    }
  } catch (err) {
    console.log("[WELCOME HOOK] Welcome WhatsApp notification error:", err.message || err);
  }

  return e.next();
}, 'transactions');
