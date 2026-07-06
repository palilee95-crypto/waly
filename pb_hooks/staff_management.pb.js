// pb_hooks/staff_management.pb.js

routerAdd("GET", "/api/waly/merchant/staff", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
  }

  const userRole = authRecord.getString("role");
  if (userRole !== "merchant" && userRole !== "both") {
    return e.json(403, { message: "Forbidden. Merchant access required." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  // Verify requester is the owner of the merchant
  let merchant;
  try {
    merchant = $app.findFirstRecordByData("merchants", "id", merchantId);
  } catch (err) {
    return e.json(404, { message: "Associated merchant not found." });
  }

  if (merchant.getString("owner") !== authRecord.id) {
    return e.json(403, { message: "Forbidden. Only the store owner can view the staff list." });
  }

  // Find all users linked to this merchant (excluding the owner)
  let staffMembers = [];
  try {
    staffMembers = $app.findRecordsByFilter(
      "users",
      `merchant_id = "${merchantId}" && id != "${authRecord.id}"`,
      "-created",
      100,
      0
    );
  } catch (err) {
    console.log("Error querying staff members:", err.message || err);
  }

  const result = staffMembers.map(u => ({
    id: u.id,
    name: u.getString("name"),
    phone: u.getString("phone"),
    email: u.getString("email"),
    avatar: u.getString("avatar"),
    role: u.getString("role")
  }));

  return e.json(200, result);
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/waly/merchant/staff", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized." });
  }

  const userRole = authRecord.getString("role");
  if (userRole !== "merchant" && userRole !== "both") {
    return e.json(403, { message: "Forbidden. Merchant access required." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  // Verify owner
  let merchant;
  try {
    merchant = $app.findFirstRecordByData("merchants", "id", merchantId);
  } catch (err) {
    return e.json(404, { message: "Associated merchant not found." });
  }

  if (merchant.getString("owner") !== authRecord.id) {
    return e.json(403, { message: "Forbidden. Only the store owner can add staff." });
  }

  const body = e.requestInfo().body;
  const phone = body.phone || '';
  if (!phone) {
    return e.json(400, { message: "Phone number is required." });
  }

  // Normalize phone number (handle Malaysia format e.g. 011... -> +6011...)
  let cleanPhone = phone.replace(/[^\d]/g, '');
  let searchPhone1 = phone;
  let searchPhone2 = phone;
  
  if (cleanPhone.startsWith('0')) {
    searchPhone1 = '+60' + cleanPhone.slice(1);
    searchPhone2 = '60' + cleanPhone.slice(1);
  } else if (cleanPhone.startsWith('60')) {
    searchPhone1 = '+' + cleanPhone;
    searchPhone2 = '0' + cleanPhone.slice(2);
  }

  // Look up user to invite by filter (trying local format, +60 format, and raw digit format)
  let targetUser;
  try {
    const filter = `phone = "${phone}" || phone = "${searchPhone1}" || phone = "${searchPhone2}" || phone = "${cleanPhone}"`;
    const users = $app.findRecordsByFilter("users", filter, "-created", 1, 0);
    if (users.length === 0) {
      throw new Error("User not found");
    }
    targetUser = users[0];
  } catch (err) {
    return e.json(404, { message: "User not found with phone number " + phone + ". Ask them to register on the Customer App first." });
  }

  // Check if they are the owner of any store
  let ownsAnyStore = false;
  try {
    const ownedMerchants = $app.findRecordsByFilter("merchants", `owner = "${targetUser.id}"`, "-created", 1, 0);
    if (ownedMerchants.length > 0) {
      ownsAnyStore = true;
    }
  } catch (err) {
    // Ignore query error
  }

  if (ownsAnyStore) {
    if (targetUser.id === authRecord.id) {
      return e.json(400, { message: "You are the owner of this store. You cannot add yourself as staff." });
    }
    return e.json(400, { message: "This user is the owner of another store and cannot be added as a staff member." });
  }

  // If already associated with another merchant as staff
  const existingMerchantId = targetUser.getString("merchant_id");
  if (existingMerchantId) {
    if (existingMerchantId === merchantId) {
      return e.json(400, { message: "This user is already a staff member at your store." });
    }
    return e.json(400, { message: "This user is already a staff member at another store." });
  }

  // Update user
  targetUser.set("merchant_id", merchantId);
  
  // Set role to 'both' so they can switch roles
  const currentRole = targetUser.getString("role");
  if (currentRole !== "both" && currentRole !== "merchant") {
    targetUser.set("role", "both");
  }

  try {
    $app.save(targetUser);
  } catch (saveErr) {
    return e.json(500, { message: "Failed to save staff record: " + saveErr.message });
  }

  return e.json(200, {
    message: "Staff member added successfully.",
    staff: {
      id: targetUser.id,
      name: targetUser.getString("name"),
      phone: targetUser.getString("phone"),
      email: targetUser.getString("email"),
      avatar: targetUser.getString("avatar"),
      role: targetUser.getString("role")
    }
  });
}, $apis.requireAuth("users"));

routerAdd("DELETE", "/api/waly/merchant/staff", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized." });
  }

  const userRole = authRecord.getString("role");
  if (userRole !== "merchant" && userRole !== "both") {
    return e.json(403, { message: "Forbidden. Merchant access required." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  // Verify owner
  let merchant;
  try {
    merchant = $app.findFirstRecordByData("merchants", "id", merchantId);
  } catch (err) {
    return e.json(404, { message: "Associated merchant not found." });
  }

  if (merchant.getString("owner") !== authRecord.id) {
    return e.json(403, { message: "Forbidden. Only the store owner can remove staff." });
  }

  const body = e.requestInfo().body;
  const userId = body.userId || '';
  if (!userId) {
    return e.json(400, { message: "User ID is required." });
  }

  if (userId === authRecord.id) {
    return e.json(400, { message: "You cannot remove yourself from your own store." });
  }

  // Look up user to remove
  let targetUser;
  try {
    targetUser = $app.findFirstRecordByData("users", "id", userId);
  } catch (err) {
    return e.json(404, { message: "Staff member not found." });
  }

  if (targetUser.getString("merchant_id") !== merchantId) {
    return e.json(400, { message: "This user does not work at your store." });
  }

  // Update user
  targetUser.set("merchant_id", "");
  
  // Reset role to 'customer' if they were 'merchant' only
  if (targetUser.getString("role") === "merchant") {
    targetUser.set("role", "customer");
  }

  try {
    $app.save(targetUser);
  } catch (saveErr) {
    return e.json(500, { message: "Failed to update staff record: " + saveErr.message });
  }

  return e.json(200, { message: "Staff member removed successfully." });
}, $apis.requireAuth("users"));
