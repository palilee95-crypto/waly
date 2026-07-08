// pb_hooks/complete_onboarding.pb.js

routerAdd("POST", "/api/risev/onboarding/complete", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
  }

  const data = e.requestInfo().body;
  const name = data.name || '';
  const email = data.email || '';


  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedName) {
    return e.json(400, { message: "Please enter your Full Name." });
  }
  if (!trimmedEmail) {
    return e.json(400, { message: "Please enter your Email Address." });
  }

  // Simple email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return e.json(400, { message: "Please enter a valid email address." });
  }
  if (trimmedEmail.endsWith('@risev.app')) {
    return e.json(400, { message: "Please use your personal email address, not a temporary @risev.app domain." });
  }

  // Check if the email is already registered by another user
  try {
    const existingUser = $app.findFirstRecordByData("users", "email", trimmedEmail);
    if (existingUser.id !== authRecord.id) {
      return e.json(400, { message: "EMAIL: Email address is already registered." });
    }
  } catch (err) {
    // Email is unique/not registered, proceed
  }

  try {
    authRecord.set("name", trimmedName);
    authRecord.set("email", trimmedEmail);
    authRecord.set("verified", true); // Auto-verify the user's email since we're setting it directly

    $app.save(authRecord);

    const duration = authRecord.collection().authToken.duration || 604800;
    const secret = authRecord.tokenKey() + authRecord.collection().authToken.secret;
    const token = $security.createJWT(
      {
        id: authRecord.id,
        type: "auth",
        collectionId: authRecord.collection().id,
      },
      secret,
      duration
    );

    return e.json(200, {
      message: "Profile successfully completed.",
      token: token,
      record: {
        id: authRecord.id,
        collectionId: authRecord.collection().id,
        collectionName: authRecord.collection().name,
        name: authRecord.getString("name"),
        email: authRecord.getString("email"),
        emailVisibility: authRecord.getBool("emailVisibility"),
        verified: authRecord.getBool("verified"),
        phone: authRecord.getString("phone"),
        role: authRecord.getString("role"),
        tier: authRecord.getString("tier"),
        total_points: authRecord.getInt("total_points"),
        merchant_id: authRecord.getString("merchant_id"),
        created: authRecord.getString("created"),
        updated: authRecord.getString("updated"),
      }
    });
  } catch (err) {
    return e.json(500, { message: "Failed to update profile: " + err.message });
  }
}, $apis.requireAuth("users"));
