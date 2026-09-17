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

  const trimmedEmail = String(email).trim().toLowerCase();
  const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailRegex.test(trimmedEmail)) {
    return e.json(400, { message: "Please enter a valid email address." });
  }
  if (trimmedEmail.endsWith('@risev.app')) {
    return e.json(400, { message: "Please use your personal email address, not a @risev.app domain." });
  }

  // Check for common typo domains (e.g. .con, gmai.com, icloud.con)
  const emailDomain = trimmedEmail.split('@')[1] || '';
  const typoDomains = {
    'icloud.con': 'icloud.com',
    'icloud.cmo': 'icloud.com',
    'iclud.com': 'icloud.com',
    'icoud.com': 'icloud.com',
    'gmail.con': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'yahoo.con': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmail.con': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'outlook.con': 'outlook.com',
    'outlok.com': 'outlook.com'
  };
  if (typoDomains[emailDomain]) {
    return e.json(400, { message: "Invalid email domain. Did you mean @" + typoDomains[emailDomain] + "?" });
  }
  if (emailDomain.endsWith('.con') || emailDomain.endsWith('.cmo') || emailDomain.endsWith('.coom')) {
    return e.json(400, { message: "Invalid email extension. Did you mean .com instead of ." + emailDomain.split('.').pop() + "?" });
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

  let normalizedBirthday = birthday;
  if (birthday) {
    const bStr = String(birthday).trim().replace(/\//g, '-');
    const bParts = bStr.split('-');
    if (bParts.length === 3) {
      let y, m, d;
      if (bParts[0].length === 4) {
        y = bParts[0]; m = bParts[1]; d = bParts[2];
      } else {
        d = bParts[0]; m = bParts[1]; y = bParts[2];
      }
      if (d.length === 1) d = '0' + d;
      if (m.length === 1) m = '0' + m;
      normalizedBirthday = `${y}-${m}-${d}`;
    }
  }
  const formattedBirthday = (normalizedBirthday && normalizedBirthday.length === 10) ? `${normalizedBirthday} 00:00:00.000Z` : normalizedBirthday;

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
  // Cloudflare Turnstile Verification Helper (scoped locally for Goja JSVM)
  function verifyTurnstileToken(token, clientIp, expectedAction) {
    if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
      return false;
    }
    const secret = $os.getenv("TURNSTILE_SECRET") || "0x4AAAAAAE5w79Mfu3Nt4ifUwMEsTWd8B0c";
    if (!secret) {
      console.log("[Turnstile Warning] TURNSTILE_SECRET is not configured!");
      return false;
    }
    const rawHostnames = $os.getenv("TURNSTILE_HOSTNAMES") || "risev.app,www.risev.app,api.risev.app,localhost,127.0.0.1";
    const expectedHostnames = rawHostnames.split(",").map(function(h) { return h.trim(); }).filter(Boolean);

    let result = null;
    try {
      const postBody = "secret=" + encodeURIComponent(secret) +
                       "&response=" + encodeURIComponent(token) +
                       (clientIp ? "&remoteip=" + encodeURIComponent(clientIp) : "");

      const res = $http.send({
        url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: postBody,
        timeout: 10
      });

      if (res.statusCode !== 200) {
        console.log("[Turnstile] HTTP error from siteverify:", res.statusCode);
        return false;
      }
      result = res.json;
    } catch (err) {
      console.log("[Turnstile] Exception during siteverify:", err.message || err);
      return false;
    }

    console.log("[Turnstile siteverify response]:", JSON.stringify(result));

    if (!result || !result.success) {
      console.log("[Turnstile] Validation failed:", JSON.stringify(result));
      return false;
    }

    if (expectedAction && result.action && result.action !== expectedAction) {
      console.log("[Turnstile] Action mismatch:", result.action, "vs expected:", expectedAction);
      return false;
    }

    const isAllowedHostname = !result.hostname || 
      expectedHostnames.indexOf(result.hostname) !== -1 || 
      result.hostname.indexOf("risev.app") !== -1 ||
      result.hostname.indexOf("localhost") !== -1;

    if (!isAllowedHostname) {
      console.log("[Turnstile] Hostname mismatch:", result.hostname);
      return false;
    }

    return true;
  }

  const reqInfo = e.requestInfo() || {};
  const body = reqInfo.body || {};
  const identifier = body.identifier || '';
  const password = body.password || '';
  const turnstileToken = body["cf-turnstile-response"] || body.turnstileToken || '';

  if (!identifier || !password) {
    return e.json(400, { message: "Identifier and password are required" });
  }

  // Canonical Turnstile verification: gate if token is present or requested from browser origin
  const headers = reqInfo.headers || {};
  const origin = headers["origin"] || headers["referer"] || "";
  const isWebOrigin = origin.indexOf("risev.app") !== -1 || origin.indexOf("localhost") !== -1;
  const clientIp = headers["cf-connecting-ip"] || headers["x-real-ip"] || headers["x-forwarded-for"] || "";

  if (turnstileToken) {
    const isValidHuman = verifyTurnstileToken(turnstileToken, clientIp, "login");
    if (!isValidHuman) {
      console.log("[LOGIN BLOCKED] Turnstile human verification failed for:", identifier);
      return e.json(403, { message: "Security verification failed. Please try again." });
    }
  } else if (isWebOrigin && $os.getenv("ENFORCE_TURNSTILE") === "true") {
    return e.json(403, { message: "Human verification is required." });
  }

  // Try email first if @ is present, then phone
  let user = null;
  if (identifier.includes('@')) {
    try {
      user = $app.findAuthRecordByEmail("users", identifier);
    } catch (err) {}
  }

  // If not found by email or identifier is a phone number, look up by phone
  if (!user) {
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
    console.log("[LOGIN FAILED]", identifier, user ? "invalid password" : "user not found");
    return e.json(401, { message: "Invalid credentials" });
  }

  console.log("[LOGIN SUCCESS]", identifier, "user:", user.id);

  const userEmail = user.getString("email") || "";
  const isShadowOrQuick = userEmail.startsWith("quick_") || userEmail.startsWith("shadow_");
  if (!user.getBool("verified") && !isShadowOrQuick) {
    return e.json(400, { message: "Please verify your email address before logging in." });
  }

  let token = "";
  try {
    const duration = user.collection().authToken.duration || 604800;
    const secret = user.tokenKey() + user.collection().authToken.secret;
    token = $security.createJWT(
      {
        id: user.id,
        type: "auth",
        collectionId: user.collection().id,
      },
      secret,
      duration
    );
  } catch (tokErr) {
    console.log("[LOGIN JWT ERROR]:", tokErr.message || tokErr);
  }

  return e.json(200, {
    success: true,
    token: token,
    record: {
      id: user.id,
      email: user.getString("email"),
      name: user.getString("name"),
      role: user.getString("role"),
      phone: user.getString("phone"),
      avatar: user.getString("avatar"),
      birthday: user.getString("birthday"),
      verified: user.getBool("verified"),
      merchant_id: user.getString("merchant_id"),
      tier: user.getString("tier"),
      total_points: user.getInt("total_points"),
      branch: user.getString("branch"),
      branch_name: user.getString("branch_name")
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
  if (identifier.includes('@')) {
    try {
      user = $app.findAuthRecordByEmail("users", identifier);
    } catch (err) {}
  }

  if (!user) {
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