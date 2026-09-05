// pb_hooks/staff_management.pb.js

routerAdd("GET", "/api/risev/merchant/staff", (e) => {
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

  // Verify requester is linked to merchant
  let merchant;
  try {
    merchant = $app.findFirstRecordByData("merchants", "id", merchantId);
  } catch (err) {
    return e.json(404, { message: "Associated merchant not found." });
  }

  const isOwner = merchant.getString("owner") === authRecord.id;

  // Query params
  const query = e.requestInfo().query || {};
  const timeframe = (query.timeframe || "all").toLowerCase();
  const sortBy = (query.sort_by || "stamps").toLowerCase();

  // Find all users linked to this merchant (excluding the owner)
  let staffMembers = [];
  try {
    staffMembers = $app.findRecordsByFilter(
      "users",
      `merchant_id = "${merchantId}" && id != "${merchant.getString("owner")}"`,
      "-created",
      200,
      0
    );
  } catch (err) {
    console.log("Error querying staff members:", err.message || err);
  }

  // Determine date filter for transactions
  let dateFilterStr = "";
  const now = new Date();
  if (timeframe === "today") {
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    dateFilterStr = ` && created >= "${startOfToday.toISOString().replace('T', ' ').substring(0, 19)}"`;
  } else if (timeframe === "week") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    dateFilterStr = ` && created >= "${sevenDaysAgo.toISOString().replace('T', ' ').substring(0, 19)}"`;
  } else if (timeframe === "month") {
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    dateFilterStr = ` && created >= "${startOfMonth.toISOString().replace('T', ' ').substring(0, 19)}"`;
  }

  // Pre-fetch transactions for this merchant to aggregate staff performance
  let merchantTxns = [];
  try {
    merchantTxns = $app.findRecordsByFilter(
      "transactions",
      `merchant = "${merchantId}"${dateFilterStr}`,
      "-created",
      2000,
      0
    );
  } catch (err) {
    console.log("Error querying transactions for staff performance:", err.message || err);
  }

  let totalStoreStamps = 0;
  let totalStoreSales = 0;
  let totalStoreTxns = 0;

  let staffStats = staffMembers.map(u => {
    const staffId = u.id;
    const staffName = u.getString("name");
    const branchName = u.getString("branch_name") || "All Branches (HQ)";

    let stampsIssued = 0;
    let vouchersRedeemed = 0;
    let customersServed = 0;
    let salesVolume = 0;

    merchantTxns.forEach(tx => {
      let meta = {};
      try {
        const rawMeta = tx.get("metadata");
        if (typeof rawMeta === "string" && rawMeta.trim()) {
          meta = JSON.parse(rawMeta);
        } else if (typeof rawMeta === "object" && rawMeta !== null) {
          meta = rawMeta;
        }
      } catch (parseErr) {}

      const matchesStaff = meta.staff_id === staffId || (meta.staff_name && meta.staff_name === staffName);
      if (matchesStaff) {
        const txType = tx.getString("type");
        const bill = parseFloat(tx.get("bill_amount")) || 0;
        const stamps = parseInt(tx.get("stamps")) || 0;

        customersServed += 1;
        salesVolume += bill;

        if (txType === "earn") {
          stampsIssued += (stamps || 1);
        } else if (txType === "redeem" || txType === "reward") {
          vouchersRedeemed += 1;
        }
      }
    });

    totalStoreStamps += stampsIssued;
    totalStoreSales += salesVolume;
    totalStoreTxns += customersServed;

    return {
      id: u.id,
      name: staffName,
      phone: u.getString("phone"),
      email: u.getString("email"),
      avatar: u.getString("avatar"),
      role: u.getString("role"),
      branch_name: branchName,
      stamps_issued: stampsIssued,
      vouchers_redeemed: vouchersRedeemed,
      customers_served: customersServed,
      sales_volume: Math.round(salesVolume * 100) / 100
    };
  });

  // Sort staff according to metric
  if (sortBy === "sales") {
    staffStats.sort((a, b) => b.sales_volume - a.sales_volume || b.stamps_issued - a.stamps_issued);
  } else if (sortBy === "customers") {
    staffStats.sort((a, b) => b.customers_served - a.customers_served || b.stamps_issued - a.stamps_issued);
  } else {
    // Default: stamps
    staffStats.sort((a, b) => b.stamps_issued - a.stamps_issued || b.sales_volume - a.sales_volume);
  }

  // Assign ranking badges & positions
  staffStats = staffStats.map((s, idx) => ({
    ...s,
    rank: idx + 1
  }));

  const topPerformer = staffStats.length > 0 && staffStats[0].stamps_issued > 0 ? staffStats[0] : null;

  return e.json(200, {
    staff: staffStats,
    timeframe: timeframe,
    top_performer: topPerformer,
    summary: {
      total_staff: staffStats.length,
      total_stamps: totalStoreStamps,
      total_sales: Math.round(totalStoreSales * 100) / 100,
      total_customers_served: totalStoreTxns
    }
  });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/risev/merchant/staff", (e) => {
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

  const body = e.requestInfo().body || {};
  const phone = body.phone || '';
  const name = (body.name || '').trim();
  const branch = (body.branch || body.branch_name || '').trim();

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
  } else if (!cleanPhone.startsWith('+60') && cleanPhone.length >= 9) {
    searchPhone1 = '+60' + cleanPhone;
    searchPhone2 = '60' + cleanPhone;
  }

  // Look up user to invite by filter (trying local format, +60 format, and raw digit format)
  let targetUser = null;
  try {
    const filter = `phone = "${phone}" || phone = "${searchPhone1}" || phone = "${searchPhone2}" || phone = "${cleanPhone}"`;
    const users = $app.findRecordsByFilter("users", filter, "-created", 1, 0);
    if (users.length > 0) {
      targetUser = users[0];
    }
  } catch (err) {}

  if (!targetUser) {
    // Auto-create shadow staff account!
    try {
      const userCol = $app.findCollectionByNameOrId("users");
      targetUser = new Record(userCol);
      targetUser.set("id", $security.randomString(15).toLowerCase());
      targetUser.set("phone", searchPhone1);
      targetUser.set("name", name || ("Staff (" + cleanPhone.slice(-4) + ")"));
      targetUser.set("email", `shadow_staff_${cleanPhone}@risev.app`);
      targetUser.set("role", "both");
      targetUser.set("merchant_id", merchantId);
      targetUser.set("branch_name", branch || "All Branches (HQ)");
      targetUser.set("birthday", "2000-01-01 00:00:00.000Z");
      targetUser.set("verified", false);
      targetUser.setPassword($security.randomString(20));
      $app.save(targetUser);

      return e.json(200, {
        message: "Staff member added successfully.",
        staff: {
          id: targetUser.id,
          name: targetUser.getString("name"),
          phone: targetUser.getString("phone"),
          email: targetUser.getString("email"),
          avatar: targetUser.getString("avatar"),
          role: targetUser.getString("role"),
          branch_name: targetUser.getString("branch_name") || branch || "All Branches (HQ)",
          stamps_issued: 0,
          vouchers_redeemed: 0
        }
      });
    } catch (createErr) {
      return e.json(500, { message: "Failed to create staff account: " + createErr.message });
    }
  }

  // If name provided and target user has placeholder name, update it
  if (name) {
    const currentName = targetUser.getString("name") || "";
    if (!currentName || currentName.startsWith("User ") || currentName.startsWith("Staff (") || currentName.startsWith("Customer ")) {
      targetUser.set("name", name);
    }
  }

  // Check if they are the owner of any store
  let ownsAnyStore = false;
  try {
    const ownedMerchants = $app.findRecordsByFilter("merchants", `owner = "${targetUser.id}"`, "-created", 10, 0);
    for (let i = 0; i < ownedMerchants.length; i++) {
      const om = ownedMerchants[i];
      if (om.id === merchantId) {
        return e.json(400, { message: "You are the owner of this store. You cannot add yourself as staff." });
      }
      
      // Check if it's an empty dummy shop (pending, 0 txs, 0 loyalty cards)
      let txCount = 0;
      try {
        const txs = $app.findRecordsByFilter("transactions", `merchant = "${om.id}"`, "-created", 1, 0);
        txCount = txs.length;
      } catch (cntErr) {}

      if (om.getString("status") === "pending" && txCount === 0) {
        // It is an unconfigured signup shop - delete it to free the user
        try {
          $app.delete(om);
        } catch (delErr) {}
      } else {
        ownsAnyStore = true;
      }
    }
  } catch (err) {
    // Ignore query error
  }

  if (ownsAnyStore) {
    return e.json(400, { message: "This user is the owner of another store and cannot be added as a staff member." });
  }

  // If already associated with another merchant as staff
  const existingMerchantId = targetUser.getString("merchant_id");
  if (existingMerchantId && existingMerchantId !== merchantId) {
    // Check if the existing linked merchant was an empty pending store that got deleted
    let existingMerchantExists = false;
    try {
      $app.findFirstRecordByData("merchants", "id", existingMerchantId);
      existingMerchantExists = true;
    } catch (eErr) {}

    if (existingMerchantExists) {
      return e.json(400, { message: "This user is already a staff member at another store." });
    }
  }

  // Update user
  targetUser.set("merchant_id", merchantId);
  if (branch) {
    targetUser.set("branch_name", branch);
  }
  
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
      role: targetUser.getString("role"),
      branch_name: targetUser.getString("branch_name") || branch || "All Branches (HQ)",
      stamps_issued: 0,
      vouchers_redeemed: 0
    }
  });
}, $apis.requireAuth("users"));

routerAdd("DELETE", "/api/risev/merchant/staff", (e) => {
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

  const body = e.requestInfo().body || {};
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
  targetUser.set("branch_name", "");
  targetUser.set("branch", "");
  
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

// ── Staff Permissions API ──────────────────────────────────────────
routerAdd("GET", "/api/risev/merchant/staff/permissions", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  let merchant;
  try {
    merchant = $app.findFirstRecordByData("merchants", "id", merchantId);
  } catch (err) {
    return e.json(404, { message: "Associated merchant not found." });
  }

  const isOwner = merchant.getString("owner") === authRecord.id;

  let meta = {};
  try {
    let rawStr = "";
    try { rawStr = merchant.getString("metadata"); } catch (e) {}
    if (rawStr && rawStr.trim()) {
      const parsed = JSON.parse(rawStr);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        meta = Object.assign({}, parsed);
      }
    } else {
      const rawObj = merchant.get("metadata");
      if (rawObj && typeof rawObj === "object" && !Array.isArray(rawObj)) {
        meta = Object.assign({}, rawObj);
      }
    }
  } catch (mErr) {
    meta = {};
  }

  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    meta = {};
  }

  const defaultPermissions = {
    can_view_analytics: false,
    can_view_marketing: false,
    can_manage_rewards: false,
    can_manage_customers: false,
    can_edit_store_profile: false,
    can_manage_branches: false
  };

  const permissions = Object.assign({}, defaultPermissions, meta.staff_permissions || {});

  return e.json(200, {
    isOwner: isOwner,
    permissions: permissions
  });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/risev/merchant/staff/permissions", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  let merchant;
  try {
    merchant = $app.findFirstRecordByData("merchants", "id", merchantId);
  } catch (err) {
    return e.json(404, { message: "Associated merchant not found." });
  }

  // Only store owner can update staff permissions
  if (merchant.getString("owner") !== authRecord.id) {
    return e.json(403, { message: "Forbidden. Only the store owner can modify staff permissions." });
  }

  const body = e.requestInfo().body || {};
  const newPermissions = body.permissions || {};

  let meta = {};
  try {
    let rawStr = "";
    try { rawStr = merchant.getString("metadata"); } catch (e) {}
    if (rawStr && rawStr.trim()) {
      const parsed = JSON.parse(rawStr);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        meta = Object.assign({}, parsed);
      }
    } else {
      const rawObj = merchant.get("metadata");
      if (rawObj && typeof rawObj === "object" && !Array.isArray(rawObj)) {
        meta = Object.assign({}, rawObj);
      }
    }
  } catch (mErr) {
    meta = {};
  }

  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    meta = {};
  }

  if (meta.onboarded === undefined && merchant.getString("name") !== "") {
    meta.onboarded = true;
  }

  meta.staff_permissions = {
    can_view_analytics: !!newPermissions.can_view_analytics,
    can_view_marketing: !!newPermissions.can_view_marketing,
    can_manage_rewards: !!newPermissions.can_manage_rewards,
    can_manage_customers: !!newPermissions.can_manage_customers,
    can_edit_store_profile: !!newPermissions.can_edit_store_profile,
    can_manage_branches: !!newPermissions.can_manage_branches
  };

  merchant.set("metadata", meta);

  try {
    $app.save(merchant);
  } catch (saveErr) {
    return e.json(500, { message: "Failed to save permissions: " + saveErr.message });
  }

  return e.json(200, {
    message: "Staff permissions updated successfully.",
    permissions: meta.staff_permissions
  });
}, $apis.requireAuth("users"));

