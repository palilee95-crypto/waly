// otp_send.pb.js
// Registration (no OTP) + OTP for password reset only + phone login endpoint.

// ── Check if phone exists ──────────────────────────────────────────
routerAdd("GET", "/api/risev/check-phone", (e) => {
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

// ── Register (no OTP — direct account creation) ────────────────────
routerAdd("POST", "/api/risev/register", (e) => {
  const body = e.requestInfo().body;
  const phone = body.phone || '';
  const email = body.email || '';
  const name = body.name || '';
  const password = body.password || '';
  const role = body.role || 'customer';
  const birthday = body.birthday || '';

  if (!phone || !email || !password || !birthday) {
    return e.json(400, { message: "phone, email, password, and birthday are required" });
  }
  if (password.length < 8) {
    return e.json(400, { message: "Password must be at least 8 characters" });
  }

  // Check phone uniqueness
  try {
    $app.findFirstRecordByData("users", "phone", phone);
    return e.json(400, { message: "Phone number is already registered" });
  } catch (err) { /* ok */ }

  // Check email uniqueness
  try {
    $app.findFirstRecordByData("users", "email", email);
    return e.json(400, { message: "Email address is already registered" });
  } catch (err) { /* ok */ }

  try {
    const collection = $app.findCollectionByNameOrId("users");
    const user = new Record(collection);
    user.set("phone", phone);
    user.set("email", email);
    user.set("name", name || `User ${phone.slice(-4)}`);
    user.set("role", role);
    user.set("birthday", birthday);
    user.set("verified", true);
    user.setPassword(password);
    $app.save(user);

    // Auto-provision merchant if role is merchant or both
    if (role === 'merchant' || role === 'both') {
      try {
        const mc = $app.findCollectionByNameOrId("merchants");
        const merchant = new Record(mc);
        merchant.set("name", `${user.getString("name")}'s Shop`);
        merchant.set("owner", user.id);
        merchant.set("category", "food");
        merchant.set("status", "pending");
        $app.save(merchant);
        user.set("merchant_id", merchant.id);
        $app.save(user);
      } catch (mErr) {
        console.log("Merchant provisioning failed: " + (mErr.message || mErr));
      }
    }

    return e.json(200, { success: true, message: "Registration successful" });
  } catch (createErr) {
    return e.json(500, { message: "Failed to create user: " + createErr.message });
  }
});

// ── Login with phone or email + password ───────────────────────────
routerAdd("POST", "/api/risev/login", (e) => {
  const body = e.requestInfo().body;
  const identifier = body.identifier || '';
  const password = body.password || '';

  if (!identifier || !password) {
    return e.json(400, { message: "Identifier and password are required" });
  }

  // Try email first, then phone
  let user = null;
  try {
    user = $app.findAuthRecordByEmail("users", identifier);
  } catch (err) {
    try {
      const users = $app.findRecordsByFilter("users", `phone = "${identifier}"`, "created", 1, 0);
      if (users.length > 0) user = users[0];
    } catch (e2) { /* not found */ }
  }

  if (!user || !user.validatePassword(password)) {
    return e.json(401, { message: "Invalid credentials" });
  }

  return e.json(200, {
    success: true,
    record: {
      id: user.id,
      email: user.getString("email"),
      name: user.getString("name"),
      role: user.getString("role"),
      phone: user.getString("phone"),
    }
  });
});

// ── Request OTP (password reset only) ──────────────────────────────
routerAdd("POST", "/api/risev/request-otp", (e) => {
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

  try {
    const res = $http.send({
      url: "http://127.0.0.1:8090/api/collections/users/request-otp",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.getString("email") })
    });

    if (res.statusCode >= 400) {
      return e.json(res.statusCode, JSON.parse(res.raw));
    }

    const resData = JSON.parse(res.raw);
    return e.json(200, { message: "OTP sent successfully", otpId: resData.otpId, email: user.getString("email") });
  } catch (otpErr) {
    return e.json(500, { message: "Failed to send OTP: " + otpErr.message });
  }
});

// ── Reset password with OTP ────────────────────────────────────────
routerAdd("POST", "/api/risev/reset-password", (e) => {
  const body = e.requestInfo().body;
  const phone = body.phone || '';
  const otpId = body.otpId || '';
  const otpCode = body.otpCode || '';
  const newPassword = body.newPassword || '';

  if (!phone || !otpId || !otpCode || !newPassword) {
    return e.json(400, { message: "All fields are required" });
  }
  if (newPassword.length < 8) {
    return e.json(400, { message: "Password must be at least 8 characters" });
  }

  // Verify OTP via PocketBase built-in
  // We need the user's email to confirm the OTP
  let resetUser;
  try {
    resetUser = $app.findFirstRecordByData("users", "phone", phone);
  } catch (err) {
    return e.json(404, { message: "User not found" });
  }

  try {
    const res = $http.send({
      url: "http://127.0.0.1:8090/api/collections/users/confirm-otp",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        otpId: otpId,
        password: otpCode,
        email: resetUser.getString("email")
      })
    });

    if (res.statusCode >= 400) {
      return e.json(400, { message: "Invalid or expired OTP code" });
    }
  } catch (err) {
    return e.json(400, { message: "OTP verification failed: " + err.message });
  }

  // Reset password
  resetUser.setPassword(newPassword);
  $app.save(resetUser);

  return e.json(200, { success: true, message: "Password reset successful" });
});

// ── OTP delivery via WhatsApp (password reset) ─────────────────────
onMailerRecordOTPSend((e) => {
  const email = e.record.get('email') || '';
  const phone = e.record.get('phone') || '';
  const otp = e.meta.password;

  const target = phone || email;
  if (!target) return e.next();

  const cleanPhone = target.replace(/[^\d]/g, '');

  console.log("\n========================================");
  console.log("🔑 [PASSWORD RESET OTP] Sent to: " + cleanPhone);
  console.log("👉 OTP Code: " + otp);
  console.log("========================================\n");

  const { sendTextMessage } = require(`${__hooks}/whatsapp_helper.js`);

  try {
    sendTextMessage(
      'risev-instance',
      cleanPhone,
      `Your RISEV password reset code is: *${otp}*\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
      { delay: 2000, presence: 'composing' }
    );
  } catch (err) {
    // Ignore — OTP is also logged to console
  }
});