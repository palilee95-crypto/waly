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

  // Pre-fetch merchant_staff records to link role_title and metadata
  const msLookupByUser = {};
  try {
    const msList = $app.findRecordsByFilter("merchant_staff", `merchant = "${merchantId}"`, "created", 200, 0);
    msList.forEach(ms => {
      const uid = ms.getString("user");
      if (uid) msLookupByUser[uid] = ms;
      const ph = (ms.getString("phone") || "").replace(/[^\d]/g, '');
      if (ph) msLookupByUser[ph] = ms;
      const nm = (ms.getString("name") || "").toLowerCase().trim();
      if (nm) msLookupByUser[nm] = ms;
    });
  } catch (msErr) {}

  // Pre-calculate staff ratings from service_bookings
  const staffRatingStats = {};
  try {
    const ratedBookings = $app.findRecordsByFilter(
      "service_bookings",
      `merchant = "${merchantId}" && status = "completed"`,
      "-booking_date",
      1500,
      0
    );
    ratedBookings.forEach(b => {
      let bMeta = {};
      try {
        const raw = b.getString("metadata");
        bMeta = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
      } catch (e) {}
      const sId = bMeta.staff_id || b.getString("staff") || "";
      const rScore = parseInt(bMeta.staff_rating, 10);
      if (sId && rScore >= 1 && rScore <= 5) {
        if (!staffRatingStats[sId]) staffRatingStats[sId] = { total: 0, count: 0 };
        staffRatingStats[sId].total += rScore;
        staffRatingStats[sId].count += 1;
      }
    });
  } catch (rErr) {}

  staffMembers.forEach(u => {
    const sPhone = (u.getString("phone") || "").replace(/[^\d]/g, '');
    const sName = (u.getString("name") || "").toLowerCase().trim();
    const linkedMs = msLookupByUser[u.id] || msLookupByUser[sPhone] || msLookupByUser[sName];
    const msId = linkedMs ? linkedMs.id : "";
    const roleTitle = linkedMs ? (linkedMs.getString("role_title") || "Staff") : (u.getString("role_title") || "Staff");

    let uMeta = {};
    try {
      const rawUM = u.get("metadata");
      uMeta = typeof rawUM === "string" ? JSON.parse(rawUM) : (rawUM || {});
    } catch (uErr) { uMeta = {}; }

    const uRatingInfo = staffRatingStats[u.id] || (msId ? staffRatingStats[msId] : null);
    const avgScore = uRatingInfo && uRatingInfo.count > 0 ? Math.round((uRatingInfo.total / uRatingInfo.count) * 10) / 10 : 0;
    const rCount = uRatingInfo ? uRatingInfo.count : 0;

    const sObj = {
      id: u.id,
      merchant_staff_id: msId,
      name: u.getString("name"),
      role_title: roleTitle,
      phone: u.getString("phone"),
      email: u.getString("email"),
      avatar: u.getString("avatar"),
      role: u.getString("role"),
      branch_name: u.getString("branch_name") || "All Branches (HQ)",
      employment_type: u.getString("employment_type") || (linkedMs ? linkedMs.getString("employment_type") : "") || uMeta.employment_type || "full_time",
      base_salary: parseFloat(u.get("base_salary")) || (linkedMs ? parseFloat(linkedMs.get("base_salary")) : 0) || parseFloat(uMeta.base_salary) || 0,
      hourly_rate: parseFloat(u.get("hourly_rate")) || (linkedMs ? parseFloat(linkedMs.get("hourly_rate")) : 0) || parseFloat(uMeta.hourly_rate) || 0,
      commission_type: u.getString("commission_type") || (linkedMs ? linkedMs.getString("commission_type") : "") || uMeta.commission_type || "none",
      commission_rate: parseFloat(u.get("commission_rate")) || (linkedMs ? parseFloat(linkedMs.get("commission_rate")) : 0) || parseFloat(uMeta.commission_rate) || 0,
      attendance_status: u.getString("attendance_status") || (linkedMs ? (linkedMs.get("is_active") === false ? "on_leave" : linkedMs.getString("attendance_status")) : "") || uMeta.attendance_status || "active",
      leave_reason: u.getString("leave_reason") || (linkedMs ? linkedMs.getString("leave_reason") : "") || uMeta.leave_reason || "",
      leave_updated_at: u.getString("leave_updated_at") || (linkedMs ? linkedMs.getString("leave_updated_at") : "") || uMeta.leave_updated_at || "",
      rating_avg: avgScore,
      rating_count: rCount,
      stamps_issued: 0,
      vouchers_redeemed: 0,
      customers_served: 0,
      sales_volume: 0,
      has_anomaly: false,
      anomaly_note: ""
    };
    staffMapById[u.id] = sObj;
    if (msId) staffMapById[msId] = sObj;
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

  // Check subscription staff limits (Stand Bundle: 3, Starter: 5, PRO: 10, Business: Unlimited)
  const isAlreadyThisStoreStaff = targetUser && targetUser.getString("merchant_id") === merchantId;
  if (!isAlreadyThisStoreStaff) {
    let existingStaffCount = 0;
    try {
      const existingStaff = $app.findRecordsByFilter(
        "users",
        `merchant_id = "${merchantId}" && id != "${merchant.getString("owner")}"`,
        "-created",
        200,
        0
      );
      existingStaffCount = existingStaff.length;
    } catch (cntErr) {}

    let activePlan = "stand_bundle";
    try {
      const subs = $app.findRecordsByFilter(
        "subscriptions",
        `merchant = "${merchantId}" && (status = "active" || status = "trialing")`,
        "-created",
        1,
        0
      );
      if (subs.length > 0) {
        activePlan = (subs[0].getString("plan") || "stand_bundle").toLowerCase();
      }
    } catch (sErr) {}

    let maxStaffAllowed = 3;
    if (activePlan === "starter") {
      maxStaffAllowed = 5;
    } else if (activePlan === "pro") {
      maxStaffAllowed = 10;
    } else if (activePlan === "business" || activePlan === "enterprise") {
      maxStaffAllowed = 999999;
    } else {
      maxStaffAllowed = 3;
    }

    if (existingStaffCount >= maxStaffAllowed) {
      const planLabel = activePlan === "starter" 
        ? "Starter Plan (limit: 5 staff)" 
        : (activePlan === "pro" ? "PRO Plan (limit: 10 staff)" : "NFC Stand Package (limit: 3 staff)");
      return e.json(403, { 
        message: `You have reached the staff account limit for your ${planLabel}. Please upgrade your plan to add more staff.` 
      });
    }
  }

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

// Quick toggle attendance status (active / on_leave / inactive)
routerAdd("POST", "/api/risev/merchant/staff/attendance", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  const body = e.requestInfo().body || {};
  const staffId = (body.staff_id || "").trim();
  const status = (body.status || "active").toLowerCase();
  const reason = (body.reason || "").trim();

  if (!staffId) {
    return e.json(400, { message: "staff_id is required" });
  }

  if (["active", "on_leave", "inactive"].indexOf(status) === -1) {
    return e.json(400, { message: "Invalid status. Must be active, on_leave, or inactive" });
  }

  let staffUser = null;
  let merchantStaffRec = null;

  try {
    staffUser = $app.findRecordById("users", staffId);
  } catch (err) {}

  try {
    merchantStaffRec = $app.findRecordById("merchant_staff", staffId);
  } catch (msErr) {}

  if (!staffUser && merchantStaffRec) {
    const linkedUserId = merchantStaffRec.getString("user");
    if (linkedUserId) {
      try { staffUser = $app.findRecordById("users", linkedUserId); } catch (uErr) {}
    }
  } else if (staffUser && !merchantStaffRec) {
    try {
      const msList = $app.findRecordsByFilter("merchant_staff", `merchant = "${merchantId}" && (user = "${staffUser.id}" || phone = "${staffUser.getString("phone")}")`, "-created", 1, 0);
      if (msList.length > 0) merchantStaffRec = msList[0];
    } catch (mErr) {}
  }

  if (!staffUser && !merchantStaffRec) {
    return e.json(404, { message: "Staff record not found" });
  }

  const nowIso = new Date().toISOString();

  // Update users record
  if (staffUser) {
    let uMeta = {};
    try {
      const rawUM = staffUser.get("metadata");
      uMeta = typeof rawUM === "string" ? JSON.parse(rawUM) : (rawUM || {});
    } catch (uErr) { uMeta = {}; }
    uMeta.attendance_status = status;
    uMeta.leave_reason = status === "on_leave" ? reason : "";
    uMeta.leave_updated_at = nowIso;

    try { staffUser.set("attendance_status", status); } catch (e) {}
    try { staffUser.set("leave_reason", status === "on_leave" ? reason : ""); } catch (e) {}
    try { staffUser.set("leave_updated_at", nowIso); } catch (e) {}
    staffUser.set("metadata", JSON.stringify(uMeta));
    try { $app.save(staffUser); } catch (saveErr) {}
  }

  // Update merchant_staff record
  if (merchantStaffRec) {
    try { merchantStaffRec.set("is_active", status === "active"); } catch (e) {}
    try { merchantStaffRec.set("attendance_status", status); } catch (e) {}
    try { merchantStaffRec.set("leave_reason", status === "on_leave" ? reason : ""); } catch (e) {}
    try { $app.save(merchantStaffRec); } catch (saveErr) {}
  }

  return e.json(200, {
    success: true,
    staff_id: staffId,
    attendance_status: status,
    leave_reason: status === "on_leave" ? reason : "",
    leave_updated_at: nowIso
  });
}, $apis.requireAuth("users"));

// Configure staff compensation & employment tier
routerAdd("POST", "/api/risev/merchant/staff/compensation", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  const body = e.requestInfo().body || {};
  const staffId = (body.staff_id || "").trim();
  const employmentType = body.employment_type === "part_time" ? "part_time" : "full_time";
  const baseSalary = parseFloat(body.base_salary) || 0;
  const hourlyRate = parseFloat(body.hourly_rate) || 0;
  const commissionType = ["percentage", "fixed_per_job"].indexOf(body.commission_type) !== -1 ? body.commission_type : "none";
  const commissionRate = parseFloat(body.commission_rate) || 0;

  if (!staffId) {
    return e.json(400, { message: "staff_id is required" });
  }

  let staffUser = null;
  let merchantStaffRec = null;

  try { staffUser = $app.findRecordById("users", staffId); } catch (err) {}
  try { merchantStaffRec = $app.findRecordById("merchant_staff", staffId); } catch (msErr) {}

  if (!staffUser && merchantStaffRec) {
    const linkedUserId = merchantStaffRec.getString("user");
    if (linkedUserId) {
      try { staffUser = $app.findRecordById("users", linkedUserId); } catch (uErr) {}
    }
  } else if (staffUser && !merchantStaffRec) {
    try {
      const msList = $app.findRecordsByFilter("merchant_staff", `merchant = "${merchantId}" && (user = "${staffUser.id}" || phone = "${staffUser.getString("phone")}")`, "-created", 1, 0);
      if (msList.length > 0) merchantStaffRec = msList[0];
    } catch (mErr) {}
  }

  if (!staffUser && !merchantStaffRec) {
    return e.json(404, { message: "Staff record not found" });
  }

  if (staffUser) {
    let uMeta = {};
    try {
      const rawUM = staffUser.get("metadata");
      uMeta = typeof rawUM === "string" ? JSON.parse(rawUM) : (rawUM || {});
    } catch (uErr) { uMeta = {}; }
    uMeta.employment_type = employmentType;
    uMeta.base_salary = baseSalary;
    uMeta.hourly_rate = hourlyRate;
    uMeta.commission_type = commissionType;
    uMeta.commission_rate = commissionRate;

    try { staffUser.set("employment_type", employmentType); } catch (e) {}
    try { staffUser.set("base_salary", baseSalary); } catch (e) {}
    try { staffUser.set("hourly_rate", hourlyRate); } catch (e) {}
    try { staffUser.set("commission_type", commissionType); } catch (e) {}
    try { staffUser.set("commission_rate", commissionRate); } catch (e) {}
    staffUser.set("metadata", JSON.stringify(uMeta));
    try { $app.save(staffUser); } catch (saveErr) {}
  }

  if (merchantStaffRec) {
    try { merchantStaffRec.set("employment_type", employmentType); } catch (e) {}
    try { merchantStaffRec.set("base_salary", baseSalary); } catch (e) {}
    try { merchantStaffRec.set("hourly_rate", hourlyRate); } catch (e) {}
    try { merchantStaffRec.set("commission_type", commissionType); } catch (e) {}
    try { merchantStaffRec.set("commission_rate", commissionRate); } catch (e) {}
    try { $app.save(merchantStaffRec); } catch (saveErr) {}
  }

  return e.json(200, {
    success: true,
    staff_id: staffId,
    employment_type: employmentType,
    base_salary: baseSalary,
    hourly_rate: hourlyRate,
    commission_type: commissionType,
    commission_rate: commissionRate
  });
}, $apis.requireAuth("users"));

// Staff Role & Compensation Tiers Management
routerAdd("GET", "/api/risev/merchant/staff/roles", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
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

  let merchantMeta = {};
  try {
    const rawM = merchant.get("metadata");
    merchantMeta = typeof rawM === "string" ? JSON.parse(rawM) : (rawM || {});
  } catch (mErr) {
    merchantMeta = {};
  }

  let configuredRoles = Array.isArray(merchantMeta.staff_role_tiers) ? merchantMeta.staff_role_tiers : [];

  // Query real staff members to attach real staff counts and derive roles if none exist
  let staffMembers = [];
  try {
    staffMembers = $app.findRecordsByFilter(
      "users",
      `merchant_id = "${merchantId}" && id != "${merchant.getString("owner")}"`,
      "-created",
      200,
      0
    );
  } catch (err) {}

  let msList = [];
  try {
    msList = $app.findRecordsByFilter("merchant_staff", `merchant = "${merchantId}"`, "-created", 200, 0);
  } catch (err) {}

  const realStaff = [];
  const seenIds = {};

  staffMembers.forEach(u => {
    seenIds[u.id] = true;
    let uMeta = {};
    try {
      const raw = u.get("metadata");
      uMeta = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
    } catch (e) {}

    const matchingMs = msList.find(ms => ms.getString("user") === u.id || (ms.getString("phone") && ms.getString("phone") === u.getString("phone")));
    const roleTitle = (matchingMs && matchingMs.getString("role_title")) || u.getString("role_title") || uMeta.role_title || "Staff";
    const empType = u.getString("employment_type") || (matchingMs && matchingMs.getString("employment_type")) || uMeta.employment_type || "full_time";
    const baseSalary = parseFloat(u.get("base_salary")) || (matchingMs ? parseFloat(matchingMs.get("base_salary")) : 0) || parseFloat(uMeta.base_salary) || 0;
    const hourlyRate = parseFloat(u.get("hourly_rate")) || (matchingMs ? parseFloat(matchingMs.get("hourly_rate")) : 0) || parseFloat(uMeta.hourly_rate) || 0;
    const commType = u.getString("commission_type") || (matchingMs && matchingMs.getString("commission_type")) || uMeta.commission_type || "none";
    const commRate = parseFloat(u.get("commission_rate")) || (matchingMs ? parseFloat(matchingMs.get("commission_rate")) : 0) || parseFloat(uMeta.commission_rate) || 0;

    realStaff.push({
      id: u.id,
      name: u.getString("name"),
      avatar: u.getString("avatar"),
      role_title: roleTitle,
      employment_type: empType,
      base_salary: baseSalary,
      hourly_rate: hourlyRate,
      commission_type: commType,
      commission_rate: commRate
    });
  });

  msList.forEach(ms => {
    const linkedUser = ms.getString("user");
    if (!linkedUser || !seenIds[linkedUser]) {
      realStaff.push({
        id: ms.id,
        name: ms.getString("name"),
        avatar: ms.getString("avatar"),
        role_title: ms.getString("role_title") || "Staff",
        employment_type: ms.getString("employment_type") || "full_time",
        base_salary: parseFloat(ms.get("base_salary")) || 0,
        hourly_rate: parseFloat(ms.get("hourly_rate")) || 0,
        commission_type: ms.getString("commission_type") || "none",
        commission_rate: parseFloat(ms.get("commission_rate")) || 0
      });
    }
  });

  // If no role tiers are configured yet, derive them from real staff
  if (configuredRoles.length === 0 && realStaff.length > 0) {
    const distinctRolesMap = {};
    realStaff.forEach(s => {
      const key = (s.role_title || "Staff").trim();
      if (!distinctRolesMap[key.toLowerCase()]) {
        distinctRolesMap[key.toLowerCase()] = {
          id: 'role_' + key.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          title: key,
          employment_type: s.employment_type || 'full_time',
          base_salary: s.base_salary || 0,
          hourly_rate: s.hourly_rate || 0,
          commission_type: s.commission_type || 'none',
          commission_rate: s.commission_rate || 0,
          description: `Active store role (${s.employment_type === 'part_time' ? 'Hourly wage' : 'Monthly salary'})`
        };
      }
    });
    configuredRoles = Object.values(distinctRolesMap);
  }

  // Augment each role with real assigned staff count and assigned member details
  const augmentedRoles = configuredRoles.map(role => {
    const assigned = realStaff.filter(s => (s.role_title || '').trim().toLowerCase() === role.title.trim().toLowerCase());
    return Object.assign({}, role, {
      staff_count: assigned.length,
      assigned_staff: assigned.map(a => ({
        id: a.id,
        name: a.name,
        avatar: a.avatar
      }))
    });
  });

  return e.json(200, {
    success: true,
    roles: augmentedRoles,
    total_staff_count: realStaff.length
  });
}, $apis.requireAuth("users"));

// Save or update staff role tiers
routerAdd("POST", "/api/risev/merchant/staff/roles", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Please log in first." });
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
  const roleTiers = Array.isArray(body.role_tiers) ? body.role_tiers : [];

  let merchantMeta = {};
  try {
    const rawM = merchant.get("metadata");
    merchantMeta = typeof rawM === "string" ? JSON.parse(rawM) : (rawM || {});
  } catch (mErr) {
    merchantMeta = {};
  }

  const sanitized = roleTiers.map(r => ({
    id: String(r.id || 'role_' + Date.now()),
    title: String(r.title || '').trim(),
    employment_type: r.employment_type === 'part_time' ? 'part_time' : 'full_time',
    base_salary: parseFloat(r.base_salary) || 0,
    hourly_rate: parseFloat(r.hourly_rate) || 0,
    commission_type: ['percentage', 'fixed_per_job'].indexOf(r.commission_type) !== -1 ? r.commission_type : 'none',
    commission_rate: parseFloat(r.commission_rate) || 0,
    description: r.description ? String(r.description).trim() : ''
  })).filter(r => r.title.length > 0);

  merchantMeta.staff_role_tiers = sanitized;
  merchant.set("metadata", JSON.stringify(merchantMeta));

  try {
    $app.save(merchant);
  } catch (saveErr) {
    return e.json(500, { message: "Failed to save role tiers: " + (saveErr.message || saveErr) });
  }

  return e.json(200, {
    success: true,
    message: "Staff roles successfully updated.",
    roles: sanitized
  });
}, $apis.requireAuth("users"));

// Monthly Commission Summary & Aggregation
routerAdd("GET", "/api/risev/merchant/staff/commissions", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  const query = e.requestInfo().query || {};
  let targetMonth = (query.month || "").trim();
  if (!targetMonth || targetMonth.length < 7) {
    const d = new Date();
    targetMonth = d.toISOString().substring(0, 7); // e.g. "2026-10"
  }

  // Fetch all completed bookings for this merchant in this month
  let bookings = [];
  try {
    bookings = $app.findRecordsByFilter(
      "service_bookings",
      `merchant = "${merchantId}" && status = "completed" && booking_date >= "${targetMonth}-01" && booking_date <= "${targetMonth}-31"`,
      "-booking_date",
      2000,
      0
    );
  } catch (bErr) {
    bookings = [];
  }

  // Pre-fetch staff members to ensure all active staff appear in report
  let staffMembers = [];
  try {
    staffMembers = $app.findRecordsByFilter(
      "users",
      `merchant_id = "${merchantId}" && id != "${authRecord.id}"`,
      "name",
      200,
      0
    );
  } catch (sErr) {}

  const staffSummaryMap = {};
  staffMembers.forEach(u => {
    let uMeta = {};
    try {
      const rawUM = u.get("metadata");
      uMeta = typeof rawUM === "string" ? JSON.parse(rawUM) : (rawUM || {});
    } catch (e) {}

    staffSummaryMap[u.id] = {
      staff_id: u.id,
      staff_name: u.getString("name"),
      staff_phone: u.getString("phone"),
      role_title: u.getString("role_title") || "Staff",
      employment_type: u.getString("employment_type") || uMeta.employment_type || "full_time",
      commission_type: u.getString("commission_type") || uMeta.commission_type || "none",
      commission_rate: parseFloat(u.get("commission_rate")) || parseFloat(uMeta.commission_rate) || 0,
      total_jobs: 0,
      total_sales: 0,
      total_commission: 0,
      paid_commission: 0,
      unpaid_commission: 0,
      bookings: [],
      payouts: []
    };
  });

  let grandTotalJobs = 0;
  let grandTotalSales = 0;
  let grandTotalCommission = 0;
  let grandTotalPaid = 0;
  let grandTotalUnpaid = 0;

  bookings.forEach(b => {
    let meta = {};
    try {
      const raw = b.getString("metadata");
      meta = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
    } catch (e) {}

    const staffId = meta.staff_id || b.getString("staff") || "";
    const bill = parseFloat(b.get("total_price")) || parseFloat(meta.bill_amount) || 0;
    const comm = parseFloat(meta.commission_amount) || 0;
    const isPaid = meta.commission_payout_status === "paid";

    grandTotalJobs += 1;
    grandTotalSales += bill;
    grandTotalCommission += comm;
    if (isPaid) {
      grandTotalPaid += comm;
    } else {
      grandTotalUnpaid += comm;
    }

    if (staffId) {
      if (!staffSummaryMap[staffId]) {
        staffSummaryMap[staffId] = {
          staff_id: staffId,
          staff_name: meta.staff_name || "Staff",
          staff_phone: "",
          role_title: "Staff",
          employment_type: meta.employment_type || "full_time",
          commission_type: meta.commission_type || "none",
          commission_rate: parseFloat(meta.commission_rate) || 0,
          total_jobs: 0,
          total_sales: 0,
          total_commission: 0,
          paid_commission: 0,
          unpaid_commission: 0,
          bookings: [],
          payouts: []
        };
      }
      const sSum = staffSummaryMap[staffId];
      sSum.total_jobs += 1;
      sSum.total_sales += bill;
      sSum.total_commission += comm;
      if (isPaid) {
        sSum.paid_commission += comm;
      } else {
        sSum.unpaid_commission += comm;
      }

      sSum.bookings.push({
        id: b.id,
        booking_code: meta.booking_code || ("#SRV-" + b.id.substring(0, 4).toUpperCase()),
        date: b.getString("booking_date"),
        time: b.getString("start_time") || "",
        amount: bill,
        commission_amount: comm,
        commission_rate: sSum.commission_rate,
        status: meta.commission_payout_status || "unpaid",
        paid_at: meta.commission_paid_at || ""
      });

      if (isPaid && meta.commission_paid_at) {
        sSum.payouts.push({
          id: b.id,
          booking_code: meta.booking_code || ("#SRV-" + b.id.substring(0, 4).toUpperCase()),
          amount: comm,
          paid_at: meta.commission_paid_at
        });
      }
    }
  });

  const staffReport = Object.keys(staffSummaryMap).map(k => {
    const s = staffSummaryMap[k];
    s.total_sales = Math.round(s.total_sales * 100) / 100;
    s.total_commission = Math.round(s.total_commission * 100) / 100;
    s.paid_commission = Math.round(s.paid_commission * 100) / 100;
    s.unpaid_commission = Math.round(s.unpaid_commission * 100) / 100;
    s.payout_status = s.total_commission > 0 && s.unpaid_commission <= 0 ? "paid" : "unpaid";
    return s;
  });

  // Sort by commission earned descending
  staffReport.sort((a, b) => b.total_commission - a.total_commission || b.total_sales - a.total_sales);

  return e.json(200, {
    month: targetMonth,
    summary: {
      total_jobs: grandTotalJobs,
      total_sales: Math.round(grandTotalSales * 100) / 100,
      total_commission: Math.round(grandTotalCommission * 100) / 100,
      paid_commission: Math.round(grandTotalPaid * 100) / 100,
      unpaid_commission: Math.round(grandTotalUnpaid * 100) / 100
    },
    staff: staffReport
  });
}, $apis.requireAuth("users"));

// Mark monthly commission payout as paid
routerAdd("POST", "/api/risev/merchant/staff/commission-payout", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  const body = e.requestInfo().body || {};
  const staffId = (body.staff_id || "").trim();
  const targetMonth = (body.month || "").trim();

  if (!staffId || !targetMonth) {
    return e.json(400, { message: "staff_id and month are required" });
  }

  let bookings = [];
  try {
    bookings = $app.findRecordsByFilter(
      "service_bookings",
      `merchant = "${merchantId}" && status = "completed" && booking_date >= "${targetMonth}-01" && booking_date <= "${targetMonth}-31"`,
      "-booking_date",
      2000,
      0
    );
  } catch (bErr) {
    bookings = [];
  }

  let updatedCount = 0;
  const nowIso = new Date().toISOString();

  bookings.forEach(b => {
    let meta = {};
    try {
      const raw = b.getString("metadata");
      meta = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
    } catch (e) {}

    const bStaffId = meta.staff_id || b.getString("staff") || "";
    if (bStaffId === staffId && meta.commission_payout_status !== "paid") {
      meta.commission_payout_status = "paid";
      meta.commission_paid_at = nowIso;
      meta.commission_paid_by = authRecord.id;
      b.set("metadata", JSON.stringify(meta));
      try {
        $app.save(b);
        updatedCount += 1;
      } catch (saveErr) {}
    }
  });

  return e.json(200, {
    success: true,
    message: `Marked commission as paid for ${updatedCount} bookings.`,
    updated_count: updatedCount,
    staff_id: staffId,
    month: targetMonth,
    paid_at: nowIso
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


