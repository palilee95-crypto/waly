routerAdd("GET", "/api/waly/check-phone", (e) => {
  const query = e.requestInfo().query;
  const phone = query.phone || '';
  if (!phone) {
    return e.json(400, { message: "phone query parameter is required" });
  }
  try {
    const user = $app.findFirstRecordByData("users", "phone", phone);
    return e.json(200, { exists: true, email: user.getString("email") });
  } catch (err) {
    return e.json(200, { exists: false });
  }
});

routerAdd("POST", "/api/waly/register", (e) => {
  const body = e.requestInfo().body;
  const phone = body.phone || '';
  const email = body.email || '';
  const name = body.name || '';
  const password = body.password || '';
  const role = body.role || 'customer';

  if (!phone || !email || !password) {
    return e.json(400, { message: "phone, email, and password are required" });
  }

  // Verify if phone is already taken
  try {
    $app.findFirstRecordByData("users", "phone", phone);
    return e.json(400, { message: "Phone number is already registered" });
  } catch (err) {
    // Phone is unique, proceed
  }

  // Verify if email is already taken
  try {
    $app.findFirstRecordByData("users", "email", email);
    return e.json(400, { message: "Email address is already registered" });
  } catch (err) {
    // Email is unique, proceed
  }

  let user;
  try {
    const collection = $app.findCollectionByNameOrId("users");
    user = new Record(collection);
    user.set("phone", phone);
    user.set("email", email);
    user.set("name", name || `User ${phone.slice(-4)}`);
    user.set("role", role);
    user.setPassword(password);
    $app.save(user);

    // If the role is merchant or both, auto-create a pending merchant record
    if (role === 'merchant' || role === 'both') {
      try {
        const merchantCollection = $app.findCollectionByNameOrId("merchants");
        const merchant = new Record(merchantCollection);
        merchant.set("name", `${user.getString("name")}'s Shop`);
        merchant.set("owner", user.id);
        merchant.set("category", "food");
        merchant.set("status", "pending");
        $app.save(merchant);

        // Update user with the merchant ID reference
        user.set("merchant_id", merchant.id);
        $app.save(user);
      } catch (merchantErr) {
        console.log("Failed to auto-provision merchant profile during registration:", merchantErr.message || merchantErr);
      }
    }
  } catch (createErr) {
    return e.json(500, { message: "Failed to create user record: " + createErr.message });
  }

  // Trigger PocketBase's built-in OTP generation
  try {
    const res = $http.send({
      url: "http://127.0.0.1:8090/api/collections/users/request-otp",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: user.getString("email")
      })
    });
    
    if (res.statusCode >= 400) {
      return e.json(res.statusCode, JSON.parse(res.raw));
    }
    
    const resData = JSON.parse(res.raw);
    return e.json(200, { message: "User registered and OTP sent successfully", otpId: resData.otpId });
  } catch (otpErr) {
    return e.json(500, { message: "Failed to trigger OTP: " + otpErr.message });
  }
});

routerAdd("POST", "/api/waly/request-otp", (e) => {
  const body = e.requestInfo().body;
  const phone = body.phone || '';
  if (!phone) {
    return e.json(400, { message: "Phone number is required" });
  }

  let user;
  try {
    user = $app.findFirstRecordByData("users", "phone", phone);
  } catch (err) {
    return e.json(404, { message: "User not found with this phone number" });
  }

  // Trigger PocketBase's built-in OTP generation by calling the local REST endpoint
  try {
    const res = $http.send({
      url: "http://127.0.0.1:8090/api/collections/users/request-otp",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: user.getString("email")
      })
    });
    
    if (res.statusCode >= 400) {
      return e.json(res.statusCode, JSON.parse(res.raw));
    }
    
    const resData = JSON.parse(res.raw);
    return e.json(200, { message: "OTP sent successfully", otpId: resData.otpId, email: user.getString("email") });
  } catch (otpErr) {
    return e.json(500, { message: "Failed to trigger OTP: " + otpErr.message });
  }
});

onMailerRecordOTPSend((e) => {
  const email = e.record.get('email') || '';
  const phone = e.record.get('phone') || '';
  const otp = e.meta.password; // Raw OTP code from mailer event

  const target = phone || email;
  if (!target) {
    return e.next();
  }

  // Clean target to numbers only for WhatsApp delivery
  const cleanPhone = target.replace(/[^\d]/g, '');

  // Log OTP to server console for local developer testing!
  console.log("\n========================================");
  console.log("🔑 [LOCAL TEST OTP] Sent to: " + cleanPhone);
  console.log("👉 OTP Code: " + otp);
  console.log("========================================\n");

  const evolutionUrl = $os.getenv('EVOLUTION_API_URL') || 'http://localhost:8080';
  const evolutionKey = $os.getenv('EVOLUTION_API_KEY') || 'waly_dev_api_key';

  try {
    $http.send({
      url: `${evolutionUrl}/message/sendText/waly-instance`,
      method: 'POST',
      headers: {
        'apikey': evolutionKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: `🔑 *Kod Pengesahan WALY*\n\nKod pengesahan keselamatan anda ialah: *${otp}*\n───────────────────\n⏳ Kod ini sah untuk *5 minit* sahaja.\n⚠️ Demi keselamatan, *jangan kongsi* kod ini dengan sesiapa.\n\n⚠️ *Peringatan:* Mohon jangan laporkan (report) mesej ini sebagai spam.\n\nTerima kasih kerana menggunakan WALY!`,
        options: {
          delay: 2000,
          presence: 'composing'
        }
      }),
    });
  } catch (err) {
    // Ignore http request errors
  }

  // Do not call e.next() to prevent PocketBase from trying to send the default OTP email,
  // since we already delivered the OTP via WhatsApp using the Evolution API.
});

