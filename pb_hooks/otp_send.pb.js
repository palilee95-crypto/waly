// otp_send.pb.js
// Registration + SMTP Password Reset & Phone Login helper.

// ── Check if phone exists ──────────────────────────────────────────
const checkPhoneHandler = (e) => {
  const reqInfo = e.requestInfo() || {};
  const query = reqInfo.query || {};
  const body = reqInfo.body || {};
  let phone = query.phone || body.phone || '';

  if (!phone) {
    return e.json(400, { message: "phone parameter is required" });
  }

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
    const userEmail = user.getString("email") || "";
    const isShadow = userEmail.includes("@risev.app") || userEmail.startsWith("shadow_") || userEmail.startsWith("quick_");
    return e.json(200, { 
      exists: true, 
      verified: user.getBool("verified"),
      is_shadow: isShadow
    });
  } else {
    return e.json(200, { exists: false });
  }
};

routerAdd("GET", "/api/risev/check-phone", checkPhoneHandler);
routerAdd("POST", "/api/risev/check-phone", checkPhoneHandler);

// ── Register (no OTP — direct account creation + SMTP verification) ────────────────────
routerAdd("POST", "/api/risev/register", (e) => {
  const body = e.requestInfo().body || {};
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

  let digits = String(phone).replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = '6' + digits;
  if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
  const cleanPhone = '+' + digits;
  const rawDigits = digits;
  const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
  const phoneFilter = `phone = '${cleanPhone}' || phone = '${rawDigits}' || phone = '${localDigits}'`;

  // Check phone uniqueness with normalized digits
  let existingUser = null;
  try {
    const users = $app.findRecordsByFilter("users", phoneFilter, "-created", 1, 0);
    if (users && users.length > 0) existingUser = users[0];
  } catch (err) { /* not found */ }

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
    if (!isQuickUpgrade || (existingUser && emailUser.id !== existingUser.id)) {
      return e.json(400, { message: "Email address is already registered" });
    }
  } catch (err) { /* ok */ }

  const formattedBirthday = (birthday && birthday.length === 10) ? `${birthday} 00:00:00.000Z` : birthday;

  try {
    let user;
    if (isQuickUpgrade && existingUser) {
      user = existingUser;
    } else {
      const collection = $app.findCollectionByNameOrId("users");
      user = new Record(collection);
      user.set("phone", cleanPhone);
    }
    user.set("email", email);
    user.set("name", name || `User ${cleanPhone.slice(-4)}`);
    const existingRole = user.getString("role");
    if (existingRole === "both" || existingRole === "merchant") {
      user.set("role", existingRole);
    } else {
      user.set("role", role || "customer");
    }
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

    return e.json(200, { success: true, message: "Registration successful" });
  } catch (createErr) {
    return e.json(500, { message: "Failed to create user: " + createErr.message });
  }
});

// ── Login with phone or email + password ───────────────────────────
routerAdd("POST", "/api/risev/login", (e) => {
  const body = e.requestInfo().body || {};
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
    // Try phone lookup with normalization
    let digits = String(identifier).replace(/[^\d]/g, '');
    if (digits) {
      if (digits.startsWith('0')) digits = '6' + digits;
      if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
      const cleanPhone = '+' + digits;
      const rawDigits = digits;
      const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
      const filter = `phone = '${cleanPhone}' || phone = '${rawDigits}' || phone = '${localDigits}'`;
      try {
        const users = $app.findRecordsByFilter("users", filter, "-created", 1, 0);
        if (users && users.length > 0) user = users[0];
      } catch (findErr) { /* not found */ }
    }
  }

  if (!user || !user.validatePassword(password)) {
    return e.json(401, { message: "Invalid credentials" });
  }

  const userEmail = user.getString("email") || "";
  const isShadowOrQuick = userEmail.startsWith("quick_") || userEmail.startsWith("shadow_");
  if (!user.getBool("verified") && !isShadowOrQuick) {
    return e.json(400, { message: "Please verify your email address before logging in." });
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
    let digits = String(identifier).replace(/[^\d]/g, '');
    if (digits) {
      if (digits.startsWith('0')) digits = '6' + digits;
      if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
      const cleanPhone = '+' + digits;
      const rawDigits = digits;
      const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
      const filter = `phone = '${cleanPhone}' || phone = '${rawDigits}' || phone = '${localDigits}'`;
      try {
        const users = $app.findRecordsByFilter("users", filter, "-created", 1, 0);
        if (users && users.length > 0) user = users[0];
      } catch (findErr) { /* not found */ }
    }
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