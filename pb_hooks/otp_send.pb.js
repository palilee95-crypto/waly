// otp_send.pb.js
// Registration + SMTP Password Reset & Phone Login helper.

// Helper to normalize phone numbers and build exact matching filter
function normalizePhone(input) {
  if (!input) return { cleanPhone: '', rawDigits: '', localDigits: '', filter: '' };
  let digits = String(input).replace(/[^\d]/g, '');
  if (!digits) return { cleanPhone: '', rawDigits: '', localDigits: '', filter: '' };
  if (digits.startsWith('0')) digits = '6' + digits;
  if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
  const cleanPhone = '+' + digits;
  const rawDigits = digits;
  const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
  const filter = `phone = '${cleanPhone}' || phone = '${rawDigits}' || phone = '${localDigits}'`;
  return { cleanPhone, rawDigits, localDigits, filter };
}
globalThis.normalizePhone = normalizePhone;

// Helper to find user by phone number using normalized exact matching
function findUserByPhone(phoneInput) {
  const norm = normalizePhone(phoneInput);
  if (!norm.cleanPhone) return null;
  try {
    const users = $app.findRecordsByFilter("users", norm.filter, "-created", 1, 0);
    if (users.length > 0) return users[0];
  } catch (err) { /* not found */ }
  return null;
}
globalThis.findUserByPhone = findUserByPhone;

// ── Check if phone exists ──────────────────────────────────────────
const checkPhoneHandler = (e) => {
  const reqInfo = e.requestInfo() || {};
  const query = reqInfo.query || {};
  const body = reqInfo.body || {};
  let phone = query.phone || body.phone || '';

  if (!phone) {
    return e.json(400, { message: "phone parameter is required" });
  }

  // Normalize phone directly
  let digits = String(phone).replace(/[^\d]/g, '');
  if (!digits) return e.json(400, { message: "valid phone parameter is required" });
  if (digits.startsWith('0')) digits = '6' + digits;
  if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
  const cleanPhone = '+' + digits;
  const rawDigits = digits;
  const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
  const filter = `phone = '${cleanPhone}' || phone = '${rawDigits}' || phone = '${localDigits}'`;

  let user = null;
  try {
    const users = $app.findRecordsByFilter("users", filter, "-created", 1, 0);
    if (users && users.length > 0) user = users[0];
  } catch (err) { /* not found */ }

  if (user) {
    return e.json(200, { 
      exists: true, 
      name: user.getString("name"), 
      email: user.getString("email"),
      verified: user.getBool("verified")
    });
  } else {
    return e.json(200, { exists: false });
  }
};

routerAdd("GET", "/api/risev/check-phone", checkPhoneHandler);
routerAdd("POST", "/api/risev/check-phone", checkPhoneHandler);

// ── Register (no OTP — direct account creation + SMTP verification) ────────────────────
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

  const norm = normalizePhone(phone);
  const cleanPhone = norm.cleanPhone || phone;

  // Check phone uniqueness with normalized digits
  const existingUser = findUserByPhone(phone);
  let isQuickUpgrade = false;
  if (existingUser) {
    const existingEmail = existingUser.getString("email") || "";
    if (existingEmail.endsWith("@risev.app") || existingEmail.includes("@risev.app")) {
      isQuickUpgrade = true;
    } else {
      return e.json(400, { message: "Phone number is already registered" });
    }
  }

  // Check email uniqueness
  try {
    const emailUser = $app.findFirstRecordByData("users", "email", email);
    if (!isQuickUpgrade || emailUser.id !== existingUser.id) {
      return e.json(400, { message: "Email address is already registered" });
    }
  } catch (err) { /* ok */ }

  const formattedBirthday = (birthday && birthday.length === 10) ? `${birthday} 00:00:00.000Z` : birthday;

  try {
    let user;
    if (isQuickUpgrade) {
      user = existingUser;
    } else {
      const collection = $app.findCollectionByNameOrId("users");
      user = new Record(collection);
      user.set("phone", cleanPhone);
    }
    user.set("email", email);
    user.set("name", name || `User ${cleanPhone.slice(-4)}`);
    user.set("role", role);
    if (formattedBirthday) {
      user.set("birthday", formattedBirthday);
    }
    user.set("verified", false); // Require email verification
    user.setPassword(password);
    $app.save(user);

    try {
      $mails.sendRecordVerification($app, user);
    } catch (mailErr) {
      console.log("[Register Mail Error] Failed to send verification email:", mailErr.message || mailErr);
    }

    // Auto-provision merchant if role is merchant or both
    if (role === 'merchant' || role === 'both') {
      try {
        const merchantId = user.getString("merchant_id");
        if (!merchantId) {
          const mc = $app.findCollectionByNameOrId("merchants");
          const merchant = new Record(mc);
          merchant.set("name", `${user.getString("name")}'s Shop`);
          merchant.set("owner", user.id);
          merchant.set("category", "food");
          merchant.set("status", "pending");
          $app.save(merchant);
          user.set("merchant_id", merchant.id);
          $app.save(user);

          // Auto-provision initial pending subscription record in subscriptions collection
          try {
            const sc = $app.findCollectionByNameOrId("subscriptions");
            const sub = new Record(sc);
            sub.set("merchant", merchant.id);
            sub.set("plan", "pro");
            sub.set("status", "pending");
            sub.set("chipin_payment_id", `signup_${Date.now()}`);
            sub.set("chipin_customer_email", email || "");
            $app.save(sub);
          } catch (subErr) {
            console.log("Subscription record initialization: " + (subErr.message || subErr));
          }
        }
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
    user = findUserByPhone(identifier);
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

// ── Request Password Reset (via SMTP email) ────────────────────────
routerAdd("POST", "/api/risev/request-password-reset", (e) => {
  const body = e.requestInfo().body || {};
  const identifier = (body.identifier || body.email || body.phone || "").trim();
  if (!identifier) {
    return e.json(400, { message: "Email or phone number is required" });
  }

  let user = null;
  try {
    user = $app.findAuthRecordByEmail("users", identifier);
  } catch (err) {
    user = findUserByPhone(identifier);
  }

  if (!user) {
    // Avoid user enumeration
    return e.json(200, { message: "If an account exists, a password reset link has been sent." });
  }

  try {
    $mails.sendRecordPasswordReset($app, user);
    return e.json(200, { success: true, message: "Password reset link sent to your registered email address." });
  } catch (mailErr) {
    console.log("[SMTP Password Reset Error]:", mailErr.message || mailErr);
    return e.json(500, { message: "Failed to send password reset email: " + (mailErr.message || mailErr) });
  }
});