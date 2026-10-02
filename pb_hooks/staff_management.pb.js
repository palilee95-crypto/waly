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

  // Read merchant metadata for anomaly detection settings and dismissals
  let merchantMeta = {};
  try {
    const rawM = merchant.get("metadata");
    merchantMeta = typeof rawM === "string" ? JSON.parse(rawM) : (rawM || {});
  } catch (mErr) {
    merchantMeta = {};
  }

  const anomalySettings = Object.assign({
    enabled: true,
    max_stamps_per_customer: 5
  }, merchantMeta.anomaly_settings || {});

  const dismissedAnomalies = Array.isArray(merchantMeta.dismissed_anomalies) ? merchantMeta.dismissed_anomalies : [];

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

  // Track (staff_id -> customer_id) for anomaly detection
  const staffCustomerMap = {};

  // Build lookup maps for fast O(1) matching
  const staffMapById = {};
  const staffMapByName = {};
  const staffMapByPhone = {};

  staffMembers.forEach(u => {
    const sPhone = (u.getString("phone") || "").replace(/[^\d]/g, '');
    const sName = (u.getString("name") || "").toLowerCase().trim();
    const sObj = {
      id: u.id,
      name: u.getString("name"),
      phone: u.getString("phone"),
      email: u.getString("email"),
      avatar: u.getString("avatar"),
      role: u.getString("role"),
      branch_name: u.getString("branch_name") || "All Branches (HQ)",
      stamps_issued: 0,
      vouchers_redeemed: 0,
      customers_served: 0,
      sales_volume: 0,
      has_anomaly: false,
      anomaly_note: ""
    };
    staffMapById[u.id] = sObj;
    if (sName) {
      staffMapByName[sName] = sObj;
    }
    if (sPhone) {
      staffMapByPhone[sPhone] = sObj;
      if (sPhone.startsWith('60')) {
        staffMapByPhone['0' + sPhone.slice(2)] = sObj;
      } else if (sPhone.startsWith('0')) {
        staffMapByPhone['60' + sPhone.slice(1)] = sObj;
      }
    }
  });

  // Single-pass aggregation over all transactions
  merchantTxns.forEach(tx => {
    const txType = tx.getString("type");
    const bill = parseFloat(tx.get("bill_amount")) || 0;
    const stamps = parseInt(tx.get("stamps")) || 0;

    // Track total store overview metrics
    totalStoreSales += bill;
    totalStoreTxns += 1;
    if (txType === "earn") {
      totalStoreStamps += (stamps || 1);
    }

    // 1. Check direct staff relation column
    let targetStaffId = "";
    try {
      targetStaffId = tx.getString("staff") || "";
    } catch (e) {}

    let meta = {};
    try {
      const rawMeta = tx.get("metadata");
      if (rawMeta) {
        if (typeof rawMeta === "string" && rawMeta.trim()) {
          meta = JSON.parse(rawMeta);
        } else if (typeof rawMeta === "object" && rawMeta !== null) {
          try {
            meta = JSON.parse(JSON.stringify(rawMeta));
          } catch (e2) {
            meta = rawMeta;
          }
        }
      }
    } catch (parseErr) {}

    if (!targetStaffId) {
      targetStaffId = meta.staff_id || meta.handled_by || "";
    }

    const rawStaffName = (meta.staff_name || "").toLowerCase().trim();
    const rawStaffPhone = (meta.staff_phone || "").replace(/[^\d]/g, '');

    const matchedStaff = (targetStaffId && staffMapById[targetStaffId]) ||
                         (rawStaffName && staffMapByName[rawStaffName]) ||
                         (rawStaffPhone && staffMapByPhone[rawStaffPhone]) || null;

    if (matchedStaff) {
      matchedStaff.customers_served += 1;
      matchedStaff.sales_volume += bill;

      if (txType === "earn") {
        const earnedStamps = stamps || 1;
        matchedStaff.stamps_issued += earnedStamps;

        const custId = tx.getString("customer") || (meta && meta.customer_id) || "";
        if (custId) {
          if (!staffCustomerMap[matchedStaff.id]) {
            staffCustomerMap[matchedStaff.id] = {};
          }
          if (!staffCustomerMap[matchedStaff.id][custId]) {
            staffCustomerMap[matchedStaff.id][custId] = {
              count: 0,
              billTotal: 0,
              txs: []
            };
          }
          staffCustomerMap[matchedStaff.id][custId].count += earnedStamps;
          staffCustomerMap[matchedStaff.id][custId].billTotal += bill;
          staffCustomerMap[matchedStaff.id][custId].txs.push({
            id: tx.id,
            created: tx.getString("created"),
            stamps: earnedStamps,
            bill_amount: bill
          });
        }
      } else if (txType === "redeem" || txType === "reward") {
        matchedStaff.vouchers_redeemed += 1;
      }

      // Self-heal: If direct staff relation is missing, backfill it
      if (!tx.getString("staff")) {
        try {
          tx.set("staff", matchedStaff.id);
          $app.save(tx);
        } catch (healErr) {}
      }
    }
  });

  // Calculate anomalies if enabled
  const detectedAnomalies = [];
  if (anomalySettings.enabled) {
    const threshold = parseInt(anomalySettings.max_stamps_per_customer) || 5;
    const customerCache = {};

    Object.keys(staffCustomerMap).forEach(sId => {
      const custMap = staffCustomerMap[sId];
      const sObj = staffMapById[sId];
      if (!sObj) return;

      Object.keys(custMap).forEach(cId => {
        const item = custMap[cId];
        if (item.count >= threshold) {
          const dismissalKey = `${sId}_${cId}_${timeframe}`;
          const isDismissed = dismissedAnomalies.some(d => (
            d.key === dismissalKey ||
            (d.staff_id === sId && d.customer_id === cId && d.timeframe === timeframe)
          ));

          if (!isDismissed) {
            let custName = "Customer";
            let custPhone = "";
            try {
              if (!customerCache[cId]) {
                const cRec = $app.findRecordById("users", cId);
                customerCache[cId] = {
                  name: cRec.getString("name") || "Customer",
                  phone: cRec.getString("phone") || ""
                };
              }
              custName = customerCache[cId].name;
              custPhone = customerCache[cId].phone;
            } catch (cErr) {}

            sObj.has_anomaly = true;
            sObj.anomaly_note = `${item.count} to same customer`;

            detectedAnomalies.push({
              id: `${sId}_${cId}`,
              staff_id: sId,
              staff_name: sObj.name,
              staff_role: sObj.role || "Staff",
              customer_id: cId,
              customer_name: custName,
              customer_phone: custPhone,
              stamp_count: item.count,
              threshold: threshold,
              total_sales: Math.round(item.billTotal * 100) / 100,
              transactions: item.txs
            });
          }
        }
      });
    });
  }

  let staffStats = staffMembers.map(u => {
    const sObj = staffMapById[u.id];
    sObj.sales_volume = Math.round(sObj.sales_volume * 100) / 100;
    return sObj;
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
    anomalies: detectedAnomalies,
    anomaly_settings: anomalySettings,
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

  if (body.anomaly_settings && typeof body.anomaly_settings === "object") {
    meta.anomaly_settings = {
      enabled: body.anomaly_settings.enabled !== false,
      max_stamps_per_customer: parseInt(body.anomaly_settings.max_stamps_per_customer) || 5
    };
  }

  merchant.set("metadata", meta);

  try {
    $app.save(merchant);
  } catch (saveErr) {
    return e.json(500, { message: "Failed to save permissions: " + saveErr.message });
  }

  return e.json(200, {
    message: "Staff permissions and anomaly settings updated successfully.",
    permissions: meta.staff_permissions,
    anomaly_settings: meta.anomaly_settings
  });
}, $apis.requireAuth("users"));

// Dismiss a detected staff anomaly
routerAdd("POST", "/api/risev/merchant/staff/dismiss-anomaly", (e) => {
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

  const body = e.requestInfo().body || {};
  const staffId = (body.staff_id || "").trim();
  const customerId = (body.customer_id || "").trim();
  const timeframe = (body.timeframe || "all").trim();

  if (!staffId || !customerId) {
    return e.json(400, { message: "staff_id and customer_id are required." });
  }

  let meta = {};
  try {
    const rawMeta = merchant.get("metadata");
    meta = typeof rawMeta === "string" ? JSON.parse(rawMeta) : (rawMeta || {});
  } catch (mErr) {
    meta = {};
  }

  if (!Array.isArray(meta.dismissed_anomalies)) {
    meta.dismissed_anomalies = [];
  }

  const dismissalKey = `${staffId}_${customerId}_${timeframe}`;
  meta.dismissed_anomalies.push({
    key: dismissalKey,
    staff_id: staffId,
    customer_id: customerId,
    timeframe: timeframe,
    dismissed_at: new Date().toISOString(),
    dismissed_by: authRecord.id
  });

  if (meta.dismissed_anomalies.length > 100) {
    meta.dismissed_anomalies = meta.dismissed_anomalies.slice(-100);
  }

  merchant.set("metadata", meta);
  try {
    $app.save(merchant);
  } catch (saveErr) {
    return e.json(500, { message: "Failed to save dismissal: " + saveErr.message });
  }

  return e.json(200, {
    success: true,
    message: "Activity marked as reviewed."
  });
}, $apis.requireAuth("users"));

// Proactive Owner Web Push Notification on Unusual Staff Stamp Activity
onRecordCreate((e) => {
  if (e.record.getString("type") !== "earn") return e.next();

  const stamps = parseInt(e.record.get("stamps")) || 1;
  const merchantId = e.record.getString("merchant");
  const customerId = e.record.getString("customer");
  const staffId = e.record.getString("staff");

  if (!merchantId || !customerId || !staffId) return e.next();

  try {
    const merchant = $app.findRecordById("merchants", merchantId);
    if (!merchant) return e.next();

    const ownerId = merchant.getString("owner");
    // Ignore self-issuance by store owner
    if (staffId === ownerId) return e.next();

    let meta = {};
    try {
      const rawMeta = merchant.get("metadata");
      meta = typeof rawMeta === "string" ? JSON.parse(rawMeta) : (rawMeta || {});
    } catch (mErr) {
      meta = {};
    }

    const anomalySettings = Object.assign({
      enabled: true,
      max_stamps_per_customer: 5
    }, meta.anomaly_settings || {});

    if (!anomalySettings.enabled) return e.next();

    const threshold = parseInt(anomalySettings.max_stamps_per_customer) || 5;

    // Check count of earn transactions in the last 30 days between this staff and customer
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateStr = thirtyDaysAgo.toISOString().replace('T', ' ').substring(0, 19);

    const recentTxns = $app.findRecordsByFilter(
      "transactions",
      `merchant = "${merchantId}" && staff = "${staffId}" && customer = "${customerId}" && type = "earn" && created >= "${dateStr}"`,
      "-created",
      200,
      0
    );

    let totalStamps = 0;
    recentTxns.forEach(t => {
      totalStamps += (parseInt(t.get("stamps")) || 1);
    });

    // Check if crossing the threshold on this specific transaction
    if (totalStamps >= threshold && (totalStamps - stamps) < threshold) {
      let staffName = "Staff";
      let customerPhone = "";
      try {
        const staffRec = $app.findRecordById("users", staffId);
        staffName = staffRec.getString("name") || "Staff";
      } catch (stErr) {}

      try {
        const custRec = $app.findRecordById("users", customerId);
        customerPhone = custRec.getString("phone") || "";
      } catch (cuErr) {}

      const pushHelper = require(`${__hooks}/push_notify.js`);
      pushHelper.sendPushToUser(ownerId, {
        title: "⚠️ Unusual Activity Detected",
        body: `Staff ${staffName} has approved ${totalStamps} stamps for customer ${customerPhone || 'member'}. Tap to review.`,
        url: `/(merchant)/staff?tab=performance&anomaly_staff_id=${staffId}`,
        tag: `anomaly-${staffId}-${customerId}`
      });
      console.log(`[UNUSUAL ACTIVITY ALERT] Dispatched Web Push to owner ${ownerId} for staff ${staffId} -> customer ${customerId}`);
    }
  } catch (err) {
    console.log("[UNUSUAL ACTIVITY HOOK ERROR]", err.message || err);
  }

  return e.next();
}, "transactions");


