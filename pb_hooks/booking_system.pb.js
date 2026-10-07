// pb_hooks/booking_system.pb.js
// Booking System Lifecycle Hook for Risev
// Handles:
// 1. Pre-booking validation (phone normalization, slot buffer & overlap check)
// 2. Customer shadow account & loyalty card provisioning
// 3. Web Push dispatch to merchant & assigned staff on new booking and customer arrival
// 4. End-of-service loyalty auto-sync (transactions, stamps, points, voucher unlock, and digital receipt generation)

// -------------------------------------------------------------
// 1. ON RECORD CREATE: Validate slot, link customer, push notify
// -------------------------------------------------------------
onRecordCreate((e) => {
  // Inlined helper functions to avoid Goja/PocketBase context garbage collection and scoping issues
  function parseTimeToMinutes(tStr) {
    if (!tStr) return 0;
    tStr = ("" + tStr).trim().toUpperCase();
    var isPM = tStr.indexOf("PM") !== -1;
    var isAM = tStr.indexOf("AM") !== -1;
    var clean = tStr.replace(/[^0-9:]/g, "");
    var parts = clean.split(":");
    var h = parseInt(parts[0], 10) || 0;
    var m = parseInt(parts[1], 10) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  }

  function formatMinutesToTime(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var hPad = h < 10 ? "0" + h : "" + h;
    var mPad = m < 10 ? "0" + m : "" + m;
    return hPad + ":" + mPad;
  }

  function normalizePhone(rawPhone) {
    if (!rawPhone) return "";
    var digits = ("" + rawPhone).replace(/[^\d]/g, "");
    if (digits.startsWith("0")) digits = "6" + digits;
    if (!digits.startsWith("60") && digits.length >= 9) digits = "60" + digits;
    return "+" + digits;
  }

  function ensureCustomerAndLoyaltyCard(cleanPhone, customerName, merchantId) {
    if (!cleanPhone || !merchantId) return null;
    var digits = cleanPhone.replace(/[^\d]/g, "");
    var localDigits = digits.startsWith("60") ? "0" + digits.slice(2) : digits;

    var customer = null;
    try {
      var phoneFilter = "phone = '" + cleanPhone + "' || phone = '" + digits + "' || phone = '" + localDigits + "'";
      var users = $app.findRecordsByFilter("users", phoneFilter, "-created", 1, 0);
      if (users.length > 0) customer = users[0];
    } catch (err) {}

    if (!customer) {
      try {
        var userCol = $app.findCollectionByNameOrId("users");
        customer = new Record(userCol);
        customer.set("id", $security.randomString(15).toLowerCase());
        customer.set("phone", cleanPhone);
        customer.set("email", "shadow_cust_" + digits + "@risev.app");
        customer.set("name", customerName || ("Customer " + digits.slice(-4)));
        customer.set("role", "customer");
        customer.set("verified", true);
        customer.set("total_points", 0);
        customer.set("tier", "Bronze");
        customer.setPassword($security.randomString(20));
        $app.save(customer);
      } catch (createErr) {
        console.log("[BOOKING CUSTOMER CREATE ERROR]", createErr.message || createErr);
      }
    } else if (customerName) {
      var currentName = customer.getString("name");
      if (!currentName || currentName.startsWith("Customer ") || currentName.startsWith("Customer_")) {
        customer.set("name", customerName);
        try { $app.save(customer); } catch (e) {}
      }
    }

    if (customer) {
      try {
        var cards = $app.findRecordsByFilter(
          "loyalty_cards",
          "customer = '" + customer.id + "' && merchant = '" + merchantId + "'",
          "created",
          1,
          0
        );
        if (cards.length === 0) {
          var programId = null;
          try {
            var progs = $app.findRecordsByFilter(
              "loyalty_programs",
              "merchant = '" + merchantId + "' && is_active = true",
              "-created",
              1,
              0
            );
            if (progs.length > 0) programId = progs[0].id;
          } catch (pErr) {}

          var cardCol = $app.findCollectionByNameOrId("loyalty_cards");
          var newCard = new Record(cardCol);
          newCard.set("id", $security.randomString(15).toLowerCase());
          newCard.set("customer", customer.id);
          newCard.set("merchant", merchantId);
          if (programId) newCard.set("program", programId);
          newCard.set("stamps_collected", 0);
          newCard.set("completions", 0);
          newCard.set("status", "active");
          newCard.set("opt_in_marketing", true);
          $app.save(newCard);
        }
      } catch (cardErr) {
        console.log("[BOOKING LOYALTY CARD INIT ERROR]", cardErr.message || cardErr);
      }
    }

    return customer;
  }

  const rec = e.record;
  const merchantId = rec.getString("merchant");
  const branchId = rec.getString("branch");
  const staffId = rec.getString("staff");
  const bookingDate = (rec.getString("booking_date") || "").trim();
  const startTimeStr = (rec.getString("start_time") || "").trim();
  const rawPhone = rec.getString("customer_phone");
  const customerName = (rec.getString("customer_name") || "Customer").trim();

  // 1. Phone standardization
  const cleanPhone = normalizePhone(rawPhone);
  if (cleanPhone) {
    rec.set("customer_phone", cleanPhone);
  }

  // 2. Ensure customer account in users collection
  const customer = ensureCustomerAndLoyaltyCard(cleanPhone, customerName, merchantId);
  if (customer) {
    rec.set("customer", customer.id);
  }

  // 3. Calculate slot duration and end time with 10-minute turnaround buffer
  let totalDurationMinutes = 30; // default
  let itemsSummary = rec.get("items_summary");
  if (typeof itemsSummary === "string") {
    try { itemsSummary = JSON.parse(itemsSummary); } catch (pErr) { itemsSummary = []; }
  }
  if (Array.isArray(itemsSummary) && itemsSummary.length > 0) {
    let sumDur = 0;
    itemsSummary.forEach(function(item) {
      if (item && item.duration_minutes) sumDur += parseInt(item.duration_minutes, 10) || 0;
    });
    if (sumDur > 0) totalDurationMinutes = sumDur;
  }

  const startMins = parseTimeToMinutes(startTimeStr);
  const bufferMinutes = 10; // 10-minute turnaround buffer
  const slotEndMins = startMins + totalDurationMinutes + bufferMinutes;
  const actualServiceEndMins = startMins + totalDurationMinutes;

  if (!rec.getString("end_time")) {
    rec.set("end_time", formatMinutesToTime(actualServiceEndMins));
  }

  // 4. Overlap & Double-booking validation (if a specific staff member is assigned)
  if (staffId && bookingDate && startMins > 0) {
    try {
      const activeBookings = $app.findRecordsByFilter(
        "service_bookings",
        "merchant = '" + merchantId + "' && staff = '" + staffId + "' && booking_date = '" + bookingDate + "' && (status = 'booked' || status = 'arrived' || status = 'in_service')",
        "-created",
        100,
        0
      );

      for (let i = 0; i < activeBookings.length; i++) {
        const existing = activeBookings[i];
        if (existing.id === rec.id) continue;

        const exStartMins = parseTimeToMinutes(existing.getString("start_time"));
        let exEndMins = parseTimeToMinutes(existing.getString("end_time"));
        if (exEndMins <= exStartMins) exEndMins = exStartMins + 30;
        const exSlotEndMins = exEndMins + bufferMinutes;

        // Overlap test
        if (startMins < exSlotEndMins && slotEndMins > exStartMins) {
          throw new BadRequestError(
            "Selected staff member already has an appointment from " + formatMinutesToTime(exStartMins) + " to " + formatMinutesToTime(exSlotEndMins) + " (including a 10-minute buffer). Please select another time slot or staff member."
          );
        }
      }
    } catch (checkErr) {
      if (checkErr.status && checkErr.status >= 400) throw checkErr;
      console.log("[BOOKING OVERLAP CHECK NOTE]", checkErr.message || checkErr);
    }
  }

  e.next();

  // 5. Post-create Push Notifications
  try {
    let pushNotify = null;
    try { pushNotify = require(`${__hooks}/push_notify.js`); } catch (pnErr) {}
    if (pushNotify) {
      let serviceLabel = "Appointment";
      if (Array.isArray(itemsSummary) && itemsSummary.length > 0 && itemsSummary[0].name) {
        serviceLabel = itemsSummary.map(function(s) { return s.name; }).join(", ");
      }

      const pushPayload = {
        title: "📅 New Booking: " + customerName,
        body: serviceLabel + " on " + bookingDate + " at " + startTimeStr,
        tag: "booking-new-" + rec.id,
        url: "/(merchant)/bookings"
      };

      // Push to merchant owner & branch staff
      pushNotify.sendPushToMerchant(merchantId, branchId, pushPayload);

      // If staff has linked user account, send direct push to staff user
      if (staffId) {
        try {
          const staffRec = $app.findRecordById("merchant_staff", staffId);
          const staffUserId = staffRec ? staffRec.getString("user") : null;
          if (staffUserId) {
            pushNotify.sendPushToUser(staffUserId, pushPayload);
          }
        } catch (stErr) {}
      }
    }
  } catch (pushErr) {
    console.log("[BOOKING PUSH NOTIFICATION ERROR]", pushErr.message || pushErr);
  }
}, "service_bookings");

// -------------------------------------------------------------
// 2. ON RECORD UPDATE: Arrival alerts & End-of-service loyalty sync
// -------------------------------------------------------------
onRecordUpdate((e) => {
  function normalizePhone(rawPhone) {
    if (!rawPhone) return "";
    var digits = ("" + rawPhone).replace(/[^\d]/g, "");
    if (digits.startsWith("0")) digits = "6" + digits;
    if (!digits.startsWith("60") && digits.length >= 9) digits = "60" + digits;
    return "+" + digits;
  }

  function ensureCustomerAndLoyaltyCard(cleanPhone, customerName, merchantId) {
    if (!cleanPhone || !merchantId) return null;
    var digits = cleanPhone.replace(/[^\d]/g, "");
    var localDigits = digits.startsWith("60") ? "0" + digits.slice(2) : digits;

    var customer = null;
    try {
      var phoneFilter = "phone = '" + cleanPhone + "' || phone = '" + digits + "' || phone = '" + localDigits + "'";
      var users = $app.findRecordsByFilter("users", phoneFilter, "-created", 1, 0);
      if (users.length > 0) customer = users[0];
    } catch (err) {}

    if (!customer) {
      try {
        var userCol = $app.findCollectionByNameOrId("users");
        customer = new Record(userCol);
        customer.set("id", $security.randomString(15).toLowerCase());
        customer.set("phone", cleanPhone);
        customer.set("email", "shadow_cust_" + digits + "@risev.app");
        customer.set("name", customerName || ("Customer " + digits.slice(-4)));
        customer.set("role", "customer");
        customer.set("verified", true);
        customer.set("total_points", 0);
        customer.set("tier", "Bronze");
        customer.setPassword($security.randomString(20));
        $app.save(customer);
      } catch (createErr) {}
    }

    if (customer) {
      try {
        var cards = $app.findRecordsByFilter(
          "loyalty_cards",
          "customer = '" + customer.id + "' && merchant = '" + merchantId + "'",
          "created",
          1,
          0
        );
        if (cards.length === 0) {
          var programId = null;
          try {
            var progs = $app.findRecordsByFilter(
              "loyalty_programs",
              "merchant = '" + merchantId + "' && is_active = true",
              "-created",
              1,
              0
            );
            if (progs.length > 0) programId = progs[0].id;
          } catch (pErr) {}

          var cardCol = $app.findCollectionByNameOrId("loyalty_cards");
          var newCard = new Record(cardCol);
          newCard.set("id", $security.randomString(15).toLowerCase());
          newCard.set("customer", customer.id);
          newCard.set("merchant", merchantId);
          if (programId) newCard.set("program", programId);
          newCard.set("stamps_collected", 0);
          newCard.set("completions", 0);
          newCard.set("status", "active");
          newCard.set("opt_in_marketing", true);
          $app.save(newCard);
        }
      } catch (cardErr) {}
    }

    return customer;
  }

  const rec = e.record;
  const original = e.record.originalCopy();
  const oldStatus = original ? original.getString("status") : "";
  const newStatus = rec.getString("status");

  const merchantId = rec.getString("merchant");
  const branchId = rec.getString("branch");
  const staffId = rec.getString("staff");
  const customerName = rec.getString("customer_name") || "Customer";
  const startTimeStr = rec.getString("start_time") || "";

  e.next();

  // A. Customer Arrival Alert
  if (oldStatus !== "arrived" && newStatus === "arrived") {
    try {
      let pushNotify = null;
      try { pushNotify = require(`${__hooks}/push_notify.js`); } catch (pnErr) {}
      if (pushNotify) {
        const arrivalPayload = {
          title: "📍 Customer Arrived!",
          body: customerName + " is at the counter for their " + startTimeStr + " appointment.",
          tag: "booking-arrived-" + rec.id,
          url: "/(merchant)/bookings"
        };

        pushNotify.sendPushToMerchant(merchantId, branchId, arrivalPayload);

        if (staffId) {
          try {
            const staffRec = $app.findRecordById("merchant_staff", staffId);
            const staffUserId = staffRec ? staffRec.getString("user") : null;
            if (staffUserId) {
              pushNotify.sendPushToUser(staffUserId, arrivalPayload);
            }
          } catch (stErr) {}
        }
      }
    } catch (aErr) {
      console.log("[ARRIVAL PUSH ERROR]", aErr.message || aErr);
    }
  }

  // B. Service Completed: Option A Loyalty Engine Auto-Sync & Digital Receipt
  if (oldStatus !== "completed" && newStatus === "completed") {
    try {
      const totalPrice = parseFloat(rec.get("total_price")) || 0;
      const customerId = rec.getString("customer");
      let customer = null;

      if (customerId) {
        try { customer = $app.findRecordById("users", customerId); } catch (e) {}
      }

      if (!customer) {
        const cleanPhone = normalizePhone(rec.getString("customer_phone"));
        customer = ensureCustomerAndLoyaltyCard(cleanPhone, customerName, merchantId);
      }

      if (customer && merchantId) {
        // 1. Find merchant loyalty program
        let program = null;
        try {
          const progs = $app.findRecordsByFilter(
            "loyalty_programs",
            "merchant = '" + merchantId + "' && is_active = true",
            "-created",
            1,
            0
          );
          if (progs.length > 0) program = progs[0];
        } catch (pErr) {}

        let stampsToAward = 1; // 1 visit = 1 stamp default
        let pointsToAward = Math.floor(totalPrice);

        if (program) {
          const isStampsEnabled = program.get("enable_stamps") !== false;
          const isPointsEnabled = program.get("enable_points") !== false;
          const spendPerPoint = parseFloat(program.get("spend_per_point")) || 1;

          if (!isStampsEnabled) stampsToAward = 0;
          if (!isPointsEnabled) pointsToAward = 0;
          else if (spendPerPoint > 0) {
            pointsToAward = Math.floor(totalPrice / spendPerPoint);
          }
        }

        // 2. Insert transaction record (type: 'earn')
        let itemsSummary = rec.get("items_summary");
        if (typeof itemsSummary === "string") {
          try { itemsSummary = JSON.parse(itemsSummary); } catch (e) {}
        }
        let serviceNames = "Service Booking";
        if (Array.isArray(itemsSummary) && itemsSummary.length > 0) {
          serviceNames = itemsSummary.map(function(item) { return item.name; }).join(", ");
        }

        try {
          const txCol = $app.findCollectionByNameOrId("transactions");
          const tx = new Record(txCol);
          tx.set("id", $security.randomString(15).toLowerCase());
          tx.set("customer", customer.id);
          tx.set("merchant", merchantId);
          if (branchId) tx.set("branch", branchId);
          tx.set("type", "earn");
          tx.set("bill_amount", totalPrice);
          tx.set("stamps", stampsToAward);
          tx.set("points", pointsToAward);
          tx.set("notes", "Booking completed: " + serviceNames);
          $app.save(tx);
          console.log("[BOOKING COMPLETE] Transaction created for customer " + customer.id + ": RM" + totalPrice + ", +" + stampsToAward + " stamps");
        } catch (txErr) {
          console.log("[BOOKING TRANSACTION ERROR]", txErr.message || txErr);
        }

        // 3. Update customer loyalty card
        try {
          const cards = $app.findRecordsByFilter(
            "loyalty_cards",
            "customer = '" + customer.id + "' && merchant = '" + merchantId + "'",
            "-created",
            1,
            0
          );
          if (cards.length > 0) {
            const card = cards[0];
            const currStamps = parseInt(card.get("stamps_collected")) || 0;
            card.set("stamps_collected", currStamps + stampsToAward);
            card.set("last_activity", new Date().toISOString().replace("T", " ").substring(0, 19));
            $app.save(card);
          }
        } catch (cErr) {
          console.log("[BOOKING LOYALTY CARD UPDATE ERROR]", cErr.message || cErr);
        }

        // 4. Update customer total points
        if (pointsToAward > 0) {
          try {
            const currPoints = parseInt(customer.get("total_points")) || 0;
            customer.set("total_points", currPoints + pointsToAward);
            $app.save(customer);
          } catch (ptErr) {}
        }

        // 5. Generate digital_receipts record
        try {
          const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
          const receiptCode = "REC-" + dateStr + "-" + $security.randomString(4).toUpperCase();

          const recCol = $app.findCollectionByNameOrId("digital_receipts");
          const digitalReceipt = new Record(recCol);
          digitalReceipt.set("id", $security.randomString(15).toLowerCase());
          digitalReceipt.set("merchant", merchantId);
          digitalReceipt.set("booking", rec.id);
          digitalReceipt.set("customer", customer.id);
          digitalReceipt.set("customer_phone", customer.getString("phone") || rec.getString("customer_phone"));
          digitalReceipt.set("receipt_number", receiptCode);
          digitalReceipt.set("line_items", itemsSummary || []);
          digitalReceipt.set("total_amount", totalPrice);
          digitalReceipt.set("payment_method", "Store Counter");
          digitalReceipt.set("stamps_earned", stampsToAward);
          $app.save(digitalReceipt);

          console.log("[BOOKING COMPLETE] Digital receipt generated: " + receiptCode + " (ID: " + digitalReceipt.id + ")");
        } catch (rErr) {
          console.log("[DIGITAL RECEIPT ERROR]", rErr.message || rErr);
        }
      }
    } catch (compErr) {
      console.log("[BOOKING COMPLETION ERROR]", compErr.message || compErr);
    }
  }
}, "service_bookings");

// -------------------------------------------------------------
// 3. REST API: Customer Active Booking Endpoint
// -------------------------------------------------------------
routerAdd("GET", "/api/risev/customer/active-booking", (e) => {
  try {
    let query = {};
    try {
      query = e.requestInfo().query || {};
    } catch (qErr) {
      try {
        query = $apis.requestInfo(e).query || {};
      } catch (qErr2) {
        query = {};
      }
    }

    const authRecord = e.auth;
    const rawPhone = query.phone || query.p || (authRecord ? authRecord.getString("phone") : "");
    const queryPhone = ("" + rawPhone).trim();
    const customerId = authRecord ? authRecord.id : "";

    if (!queryPhone && !customerId) {
      return e.json(200, { booking: null });
    }

    const cleanDigits = ("" + queryPhone).replace(/[^\d]/g, "");
    const plusPhone = cleanDigits.startsWith("60") ? "+" + cleanDigits : (cleanDigits ? "+60" + cleanDigits.replace(/^0/, "") : "");
    const localPhone = cleanDigits.startsWith("60") ? "0" + cleanDigits.slice(2) : cleanDigits;

    let filterParts = [];
    if (customerId) filterParts.push("customer = '" + customerId + "'");
    if (plusPhone) filterParts.push("customer_phone = '" + plusPhone + "'");
    if (localPhone && localPhone !== plusPhone) filterParts.push("customer_phone = '" + localPhone + "'");
    if (queryPhone && queryPhone !== plusPhone && queryPhone !== localPhone) filterParts.push("customer_phone = '" + queryPhone + "'");

    const todayIso = new Date().toISOString().substring(0, 10);
    const filterStr = "(" + filterParts.join(" || ") + ") && (status = 'booked' || status = 'arrived' || (status = 'no_show' && booking_date = '" + todayIso + "')) && booking_date >= '" + todayIso + "'";

    const records = $app.findRecordsByFilter("service_bookings", filterStr, "booking_date,start_time", 10, 0);
    if (!records || records.length === 0) {
      return c.json(200, { booking: null });
    }

    // Prioritize upcoming active bookings (booked/arrived) over no_show
    let rec = records[0];
    for (let ri = 0; ri < records.length; ri++) {
      const s = records[ri].getString("status");
      if (s === "booked" || s === "arrived") {
        rec = records[ri];
        break;
      }
    }
    const merchantId = rec.getString("merchant");
    const branchId = rec.getString("branch");
    const staffId = rec.getString("staff");

    let merchantData = null;
    if (merchantId) {
      try {
        const m = $app.findRecordById("merchants", merchantId);
        if (m) {
          merchantData = {
            id: m.id,
            name: m.getString("name"),
            logo: m.getString("logo"),
            pwa_slug: m.getString("pwa_slug")
          };
        }
      } catch (e) {}
    }

    let branchData = null;
    if (branchId) {
      try {
        const b = $app.findRecordById("branches", branchId);
        if (b) branchData = { id: b.id, name: b.getString("name") };
      } catch (e) {}
    }

    let staffData = null;
    if (staffId) {
      try {
        const st = $app.findRecordById("merchant_staff", staffId);
        if (st) staffData = { id: st.id, name: st.getString("name") };
      } catch (e) {}
    }

    let itemsSummary = rec.get("items_summary");
    if (typeof itemsSummary === "string") {
      try { itemsSummary = JSON.parse(itemsSummary); } catch (e) {}
    }

    const payload = {
      id: rec.id,
      merchant: merchantId,
      branch: branchId,
      staff: staffId,
      customer: rec.getString("customer"),
      customer_name: rec.getString("customer_name"),
      customer_phone: rec.getString("customer_phone"),
      booking_date: rec.getString("booking_date"),
      start_time: rec.getString("start_time"),
      end_time: rec.getString("end_time"),
      total_price: rec.get("total_price"),
      status: rec.getString("status"),
      items_summary: itemsSummary,
      expand: {
        merchant: merchantData,
        branch: branchData,
        staff: staffData
      }
    };

    return e.json(200, { booking: payload });
  } catch (err) {
    console.log("[ACTIVE BOOKING ERROR]", err.message || err);
    return e.json(500, { error: err.message || ("" + err) });
  }
});

