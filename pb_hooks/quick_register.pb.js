// pb_hooks/quick_register.pb.js
// Frictionless quick-register for inbound QR stamp customers (Name + Phone only)

routerAdd("POST", "/api/risev/qr/quick-register", (e) => {
  try {
    const body = e.requestInfo().body || {};
    const name = (body.name || "").trim();
    let rawPhone = (body.phone || "").trim();

    if (!name || !rawPhone) {
      return e.json(400, { message: "Name and phone number are required" });
    }

    // Format phone with Malaysian country code (+60)
    let digits = rawPhone.replace(/[^\d]/g, '');
    if (digits.startsWith('0')) digits = '6' + digits;
    if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
    const cleanPhone = '+' + digits;

    const userCol = $app.findCollectionByNameOrId("users");

    // Check if user already exists by phone (search last 8 digits for Malaysian numbers)
    const last8 = digits.slice(-8);
    const existingUsers = $app.findRecordsByFilter("users", `phone ~ '${last8}'`, "-created", 1, 0);

    let user = null;
    let isNewUser = false;

    if (existingUsers.length > 0) {
      user = existingUsers[0];
      // Update name if current name is placeholder or empty, and incoming name is a real name
      const currName = user.getString("name") || "";
      if ((!currName || currName.startsWith("Customer ")) && name && !name.startsWith("Customer ")) {
        user.set("name", name);
        $app.save(user);
      }
    } else {
      isNewUser = true;
      user = new Record(userCol);
      user.set("id", $security.randomString(15).toLowerCase());
      user.set("phone", cleanPhone);
      user.set("name", name);
      user.set("email", `quick_${digits}@risev.app`);
      user.set("role", "customer");
      user.set("birthday", "2000-01-01 00:00:00.000Z");
      // Set random password hash so account exists securely until onboarding
      user.setPassword($security.randomString(20));
      $app.save(user);
    }

    // Generate user token for immediate authentication session
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
    } catch (tokenErr) {
      console.log("[QUICK REGISTER] Token creation fallback:", tokenErr.message || tokenErr);
    }

    return e.json(200, {
      success: true,
      isNewUser: isNewUser,
      token: token,
      user: {
        id: user.id,
        phone: user.getString("phone"),
        name: user.getString("name"),
        role: user.getString("role"),
        email: user.getString("email"),
      }
    });
  } catch (err) {
    return e.json(500, { message: "Quick registration failed: " + (err.message || err) });
  }
});
