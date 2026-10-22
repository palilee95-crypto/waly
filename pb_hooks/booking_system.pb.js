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
        customer.set("verified", false);
        customer.set("birthday", "2000-01-01 00:00:00.000Z");
        customer.set("total_points", 0);
        customer.setPassword($security.randomString(20));
        $app.save(customer);
      } catch (createErr) {
        console.log("[BOOKING CUSTOMER CREATE ERROR]", createErr.message || createErr);
        customer = null;
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

  // Attendance check: block booking if staff is currently on leave
  if (staffId) {
    try {
      let isStaffOnLeave = false;
      let staffName = "Staff";
      let staffReason = "";

      try {
        const msRec = $app.findRecordById("merchant_staff", staffId);
        if (msRec) {
          staffName = msRec.getString("name") || "Staff";
          if (msRec.get("is_active") === false || msRec.getString("attendance_status") === "on_leave") {
            isStaffOnLeave = true;
            staffReason = msRec.getString("leave_reason") || "";
          }
        }
      } catch (msErr) {}

      if (!isStaffOnLeave) {
        try {
          const uRec = $app.findRecordById("users", staffId);
          if (uRec) {
            staffName = uRec.getString("name") || staffName;
            if (uRec.getString("attendance_status") === "on_leave") {
              isStaffOnLeave = true;
              staffReason = uRec.getString("leave_reason") || "";
            }
          }
        } catch (uErr) {}
      }

      if (isStaffOnLeave) {
        throw new BadRequestError(`Kakitangan (${staffName}) sedang bercuti${staffReason ? ' (' + staffReason + ')' : ''}. Sila pilih kakitangan atau waktu lain.`);
      }
    } catch (valErr) {
      // JSVM error `name` is undefined -> use instanceof / status (400) instead.
      if ((valErr instanceof BadRequestError) || (valErr && valErr.status === 400) || (valErr.message && valErr.message.indexOf("bercuti") !== -1)) {
        throw valErr;
      }
    }
  }

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
  let itemsSummary = [];
  try {
    let rawItemsStr = (typeof rec.getString === "function") ? rec.getString("items_summary") : "";
    if (rawItemsStr && typeof rawItemsStr === "string" && rawItemsStr.trim()) {
      itemsSummary = JSON.parse(rawItemsStr);
    } else {
      let rawVal = rec.get("items_summary");
      if (typeof rawVal === "string" && rawVal.trim()) {
        itemsSummary = JSON.parse(rawVal);
      } else if (Array.isArray(rawVal) && rawVal.length > 0 && typeof rawVal[0] === "number") {
        let str = "";
        for (let i = 0; i < rawVal.length; i++) str += String.fromCharCode(rawVal[i]);
        itemsSummary = JSON.parse(str);
      } else if (Array.isArray(rawVal)) {
        itemsSummary = rawVal;
      }
    }
  } catch (pErr) {
    itemsSummary = [];
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
        customer.set("verified", false);
        customer.set("birthday", "2000-01-01 00:00:00.000Z");
        customer.set("total_points", 0);
        customer.setPassword($security.randomString(20));
        $app.save(customer);
      } catch (createErr) {
        customer = null;
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
      } catch (cardErr) {}
    }

    return customer;
  }

  const rec = e.record;
  let original = null;
  try {
    original = e.record.original();
  } catch (origErr) {
    try {
      original = e.record.originalCopy();
    } catch (origErr2) {}
  }
  const oldStatus = original ? (original.getString ? original.getString("status") : original.get("status")) : "";
  const newStatus = rec.getString ? rec.getString("status") : rec.get("status");

  const merchantId = rec.getString ? rec.getString("merchant") : rec.get("merchant");
  const branchId = rec.getString ? rec.getString("branch") : rec.get("branch");
  const staffId = rec.getString ? rec.getString("staff") : rec.get("staff");
  const customerName = (rec.getString ? rec.getString("customer_name") : rec.get("customer_name")) || "Customer";
  const startTimeStr = (rec.getString ? rec.getString("start_time") : rec.get("start_time")) || "";

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

  // B. Service Completed: Option A Unified Sales Ledger & Digital Receipt
  if (oldStatus !== "completed" && newStatus === "completed") {
    try {
      let bHelper = null;
      try { bHelper = require(`${__hooks}/booking_helper.js`); } catch (bhErr) {}
      if (bHelper && typeof bHelper.processCompletedBooking === "function") {
        bHelper.processCompletedBooking(rec);
      } else {
        console.log("[BOOKING COMPLETE ERROR] booking_helper.js not available");
      }
    } catch (compErr) {
      console.log("[BOOKING COMPLETION ERROR]", compErr.message || compErr);
    }
  }
}, "service_bookings");

// -------------------------------------------------------------
// 2b. REST API: Merchant Booking Status Update Endpoint
// -------------------------------------------------------------
routerAdd("POST", "/api/risev/merchant/booking-status", (e) => {
  try {
    let data = {};
    try {
      data = e.requestInfo().body || {};
    } catch (bErr) {
      try {
        data = $apis.requestInfo(e).body || {};
      } catch (bErr2) {
        data = {};
      }
    }

    const auth = e.auth;
    if (!auth) {
      return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to update a booking." });
    }

    const bookingId = data.booking_id || data.id;
    const newStatus = data.status;

    if (!bookingId || !newStatus) {
      return e.json(400, { error: "Missing booking_id or status" });
    }

    const booking = $app.findRecordById("service_bookings", bookingId);
    if (!booking) {
      return e.json(404, { error: "Booking not found" });
    }

    // The id alone is never proof: the caller must own or staff the merchant.
    const merchantId = booking.getString("merchant");
    const isSuperuser = auth.isSuperuser === true ||
      (auth.collection && auth.collection().name === "_superusers");
    let isOwner = false;
    if (merchantId) {
      try {
        isOwner = $app.findRecordById("merchants", merchantId).getString("owner") === auth.id;
      } catch (mErr) {}
    }
    const authMerchantId = typeof auth.getString === "function" ? auth.getString("merchant_id") : "";
    if (!isSuperuser && !isOwner && authMerchantId !== merchantId) {
      return e.json(403, { code: "BOOKING_FORBIDDEN", message: "That booking belongs to another store." });
    }

    const allowedStatuses = ["booked", "arrived", "in_service", "completed", "cancelled", "no_show"];
    if (allowedStatuses.indexOf(newStatus) === -1) {
      return e.json(400, { code: "BOOKING_STATUS_INVALID", message: "Unknown booking status." });
    }

    const oldStatus = booking.getString("status");

    // Arrival is a same-day action: the appointment can only be marked arrived
    // on its scheduled store-local day. The customer's self check-in applies
    // the same rule in booking_pass_helper.
    if (newStatus === "arrived" && oldStatus !== "arrived") {
      let storeToday = "";
      try {
        storeToday = require(`${__hooks}/booking_pass_helper.js`).storeTodayIso();
      } catch (dayErr) {
        storeToday = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().substring(0, 10);
      }
      if (booking.getString("booking_date") !== storeToday) {
        return e.json(409, {
          code: "BOOKING_NOT_TODAY",
          message: "This appointment can only be marked arrived on its scheduled day."
        });
      }
    }
    // Reopening a finished booking is allowed, but it cannot skip straight to
    // completed — the visit has to be in progress first.
    if (newStatus === "completed" && (oldStatus === "no_show" || oldStatus === "cancelled")) {
      return e.json(409, {
        code: "BOOKING_TRANSITION_INVALID",
        message: "Reopen the booking before completing it."
      });
    }

    if (oldStatus !== newStatus) {
      // Saving fires onRecordUpdate below, which owns processCompletedBooking.
      // Calling it here as well ran the completion twice: when the transaction
      // creation fails (velocity limit) the idempotency guard cannot stop the
      // second pass and the customer is awarded stamps twice.
      booking.set("status", newStatus);
      $app.save(booking);
    }

    return e.json(200, { success: true, booking_id: bookingId, status: newStatus });
  } catch (err) {
    console.log("[MERCHANT BOOKING STATUS ERROR]", err.message || err);
    return e.json(500, { error: err.message || "Failed to update booking status" });
  }
});

// -------------------------------------------------------------
// 2c. REST API: Merchant reschedule (date / time / staff)
// -------------------------------------------------------------
routerAdd("POST", "/api/risev/merchant/booking-reschedule", (e) => {
  try {
    const availability = require(`${__hooks}/booking_availability.js`);
    const passHelper = require(`${__hooks}/booking_pass_helper.js`);

    let data = {};
    try {
      data = e.requestInfo().body || {};
    } catch (bErr) {
      try {
        data = $apis.requestInfo(e).body || {};
      } catch (bErr2) {
        data = {};
      }
    }

    const auth = e.auth;
    if (!auth) {
      return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to update a booking." });
    }

    const bookingId = String(data.booking_id || data.id || "").trim();
    if (!bookingId) {
      return e.json(400, { code: "BOOKING_ID_REQUIRED", message: "Missing booking id." });
    }

    let booking = null;
    try {
      booking = $app.findRecordById("service_bookings", bookingId);
    } catch (fErr) {
      booking = null;
    }
    if (!booking) {
      return e.json(404, { code: "BOOKING_NOT_FOUND", message: "Booking not found." });
    }

    const merchantId = booking.getString("merchant");
    let isOwner = false;
    try {
      isOwner = $app.findRecordById("merchants", merchantId).getString("owner") === auth.id;
    } catch (mErr) {}
    const authMerchantId = typeof auth.getString === "function" ? auth.getString("merchant_id") : "";
    const isSuperuser = auth.isSuperuser === true ||
      (auth.collection && auth.collection().name === "_superusers");
    if (!isSuperuser && !isOwner && authMerchantId !== merchantId) {
      return e.json(403, { code: "BOOKING_FORBIDDEN", message: "That booking belongs to another store." });
    }

    const currentStatus = booking.getString("status");
    if (["booked", "arrived", "in_service"].indexOf(currentStatus) < 0) {
      return e.json(409, { code: "BOOKING_NOT_ACTIVE", message: "This booking can no longer be moved." });
    }

    const bookingDate = String(data.booking_date || booking.getString("booking_date")).trim();
    const startTime = String(data.start_time || booking.getString("start_time")).trim();
    if (!availability.isValidIsoDate(bookingDate)) {
      return e.json(400, { code: "BOOKING_DATE_INVALID", message: "Choose a valid date." });
    }
    const startMinutes = availability.toMinutes(startTime);
    if (!startMinutes) {
      return e.json(400, { code: "BOOKING_TIME_INVALID", message: "Choose a valid time slot." });
    }

    const today = passHelper.storeTodayIso();
    if (bookingDate < today) {
      return e.json(409, { code: "BOOKING_SLOT_PAST", message: "That date is in the past." });
    }
    if (bookingDate === today) {
      const nowMy = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const nowMinutes = nowMy.getUTCHours() * 60 + nowMy.getUTCMinutes();
      if (startMinutes <= nowMinutes) {
        return e.json(409, { code: "BOOKING_SLOT_PAST", message: "That time has already passed today." });
      }
    }

    const staffId = String(data.staff_id !== undefined && data.staff_id !== null
      ? data.staff_id
      : booking.getString("staff")).trim();
    // Same provider checks booking creation applies. They run for the retained
    // provider too, because the assignment is moving to a new slot.
    if (staffId) {
      let staffRecord = null;
      try {
        staffRecord = $app.findRecordById("merchant_staff", staffId);
      } catch (staffErr) {
        staffRecord = null;
      }
      if (!staffRecord || staffRecord.getString("merchant") !== merchantId) {
        return e.json(400, { code: "BOOKING_STAFF_INVALID", message: "That provider is not available for this store." });
      }

      let unavailableName = "";
      if (staffRecord.get("is_active") === false || staffRecord.getString("attendance_status") === "on_leave") {
        unavailableName = staffRecord.getString("name") || "This provider";
      } else {
        const staffUserId = staffRecord.getString("user");
        if (staffUserId) {
          try {
            const staffUser = $app.findRecordById("users", staffUserId);
            if (staffUser.getString("attendance_status") === "on_leave") {
              unavailableName = staffUser.getString("name") || unavailableName;
            }
          } catch (staffUserErr) {}
        }
      }
      if (unavailableName) {
        return e.json(409, {
          code: "BOOKING_STAFF_UNAVAILABLE",
          message: unavailableName + " is inactive or on leave. Choose another provider.",
        });
      }
    }

    // `end_time` is the service end; the conflict window adds the same
    // turnaround booking creation reserves (booking_system onRecordCreate).
    const TURNAROUND_MINUTES = 10;
    const duration = availability.durationMinutes(booking);
    const serviceEndMinutes = startMinutes + duration;
    const slotEndMinutes = serviceEndMinutes + TURNAROUND_MINUTES;

    let conflict = null;
    try {
      conflict = availability.findStaffConflict(merchantId, staffId, bookingDate, startMinutes, slotEndMinutes, bookingId);
    } catch (availabilityErr) {
      // Never treat an unverified slot as free.
      console.log("[BOOKING RESCHEDULE] availability query failed:", availabilityErr.message || availabilityErr);
      return e.json(500, {
        code: "BOOKING_AVAILABILITY_UNAVAILABLE",
        message: "Could not verify provider availability. Please try again.",
      });
    }
    if (conflict) {
      return e.json(409, {
        code: "BOOKING_SLOT_TAKEN",
        message: "That provider already has an appointment at this time.",
      });
    }

    let existingMeta = {};
    try {
      const rawMeta = booking.getString("metadata");
      const parsed = rawMeta && rawMeta !== "null" ? JSON.parse(rawMeta) : null;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) existingMeta = parsed;
    } catch (metaErr) {
      existingMeta = {};
    }
    const changeLog = Array.isArray(existingMeta.change_log) ? existingMeta.change_log.slice(-20) : [];
    changeLog.push({
      at: new Date().toISOString(),
      by: auth.id,
      from: {
        booking_date: booking.getString("booking_date"),
        start_time: booking.getString("start_time"),
        end_time: booking.getString("end_time"),
        staff: booking.getString("staff"),
      },
      to: { booking_date: bookingDate, start_time: startTime, staff: staffId },
    });

    booking.set("booking_date", bookingDate);
    booking.set("start_time", startTime);
    booking.set("end_time", availability.formatMinutes(serviceEndMinutes));
    booking.set("staff", staffId || null);
    existingMeta.change_log = changeLog;
    booking.set("metadata", existingMeta);
    $app.save(booking);

    // Nudge the customer; the PWA reads the live record, so the change is
    // already visible there.
    try {
      const push = require(`${__hooks}/push_notify.js`);
      let slug = "";
      try {
        slug = $app.findRecordById("merchants", merchantId).getString("pwa_slug") || "";
      } catch (slugErr) {}
      if (typeof push.sendPushNotification === "function") {
        push.sendPushNotification(
          booking.getString("customer"),
          "Appointment updated",
          "Your appointment is now " + bookingDate + " at " + startTime + ".",
          {
            phone: booking.getString("customer_phone"),
            url: slug ? "/b/" + slug + "?pass=" + bookingId : "/(customer)",
            tag: "booking-move-" + bookingId,
            type: "booking_rescheduled",
            merchantId: merchantId,
          }
        );
      }
    } catch (pushErr) {
      console.log("[BOOKING RESCHEDULE] push note:", pushErr.message || pushErr);
    }

    return e.json(200, { success: true, booking: passHelper.buildPassPayload(booking) });
  } catch (err) {
    console.log("[MERCHANT BOOKING RESCHEDULE ERROR]", err.message || err);
    return e.json(500, { code: "BOOKING_RESCHEDULE_FAILED", message: "Could not update this booking." });
  }
});

// -------------------------------------------------------------
// 2c. REST API: Backfill Missing Transactions for Completed Bookings
// -------------------------------------------------------------
routerAdd("POST", "/api/risev/admin/backfill-booking-transactions", (e) => {
  try {
    let bHelper = null;
    try { bHelper = require(`${__hooks}/booking_helper.js`); } catch (bhErr) {}
    if (!bHelper || typeof bHelper.processCompletedBooking !== "function") {
      return e.json(500, { error: "booking_helper not available" });
    }

    const bookings = $app.findRecordsByFilter(
      "service_bookings",
      "status = 'completed'",
      "-created",
      500,
      0
    );

    let processedCount = 0;
    for (let i = 0; i < bookings.length; i++) {
      const b = bookings[i];
      const res = bHelper.processCompletedBooking(b);
      if (res) processedCount++;
    }

    return e.json(200, {
      success: true,
      total_completed_bookings: bookings.length,
      newly_created_transactions: processedCount
    });
  } catch (err) {
    console.log("[BACKFILL BOOKING TRANSACTIONS ERROR]", err.message || err);
    return e.json(500, { error: err.message || "Failed to backfill" });
  }
});

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
      return e.json(200, { booking: null });
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

    let itemsSummary = [];
    try {
      let rawItemsStr = (typeof rec.getString === "function") ? rec.getString("items_summary") : "";
      if (rawItemsStr && typeof rawItemsStr === "string" && rawItemsStr.trim()) {
        itemsSummary = JSON.parse(rawItemsStr);
      } else {
        let rawVal = rec.get("items_summary");
        if (typeof rawVal === "string" && rawVal.trim()) {
          itemsSummary = JSON.parse(rawVal);
        } else if (Array.isArray(rawVal) && rawVal.length > 0 && typeof rawVal[0] === "number") {
          let str = "";
          for (let i = 0; i < rawVal.length; i++) str += String.fromCharCode(rawVal[i]);
          itemsSummary = JSON.parse(str);
        } else if (Array.isArray(rawVal)) {
          itemsSummary = rawVal;
        }
      }
    } catch (e) {
      itemsSummary = [];
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

// -------------------------------------------------------------
// REST API: Customer Staff Rating Endpoint
// -------------------------------------------------------------
routerAdd("POST", "/api/risev/booking/rate-staff", (e) => {
  try {
    let data = {};
    try {
      data = e.requestInfo().body || {};
    } catch (bErr) {
      try {
        data = $apis.requestInfo(e).body || {};
      } catch (bErr2) {
        data = {};
      }
    }

    const bookingId = (data.booking_id || data.id || "").trim();
    const rating = parseInt(data.rating, 10) || 0;
    const feedback = (data.feedback || data.review || "").trim().slice(0, 1000);

    if (!bookingId) {
      return e.json(400, { error: "Missing booking_id" });
    }
    if (rating < 1 || rating > 5) {
      return e.json(400, { error: "Rating must be an integer between 1 and 5" });
    }

    let booking;
    try {
      booking = $app.findRecordById("service_bookings", bookingId);
    } catch (err) {
      return e.json(404, { error: "Booking not found" });
    }

    // Hardening: the booking id alone is not proof of ownership. Require the
    // caller to be the booking's customer — either the authenticated user who
    // owns it, or a caller presenting the booking's phone number — and only
    // allow rating a visit that actually happened.
    const bookingPhoneDigits = (booking.getString("customer_phone") || "").replace(/[^\d]/g, "");
    const callerPhoneDigits = (data.customer_phone || data.phone || "").replace(/[^\d]/g, "");
    const authRecord = e.auth;

    const isBookingCustomer =
      (authRecord && booking.getString("customer") === authRecord.id) ||
      (authRecord && bookingPhoneDigits && (authRecord.getString("phone") || "").replace(/[^\d]/g, "") === bookingPhoneDigits) ||
      (bookingPhoneDigits && callerPhoneDigits === bookingPhoneDigits);

    if (!isBookingCustomer) {
      return e.json(403, { error: "You can only rate your own booking." });
    }

    if (booking.getString("status") !== "completed") {
      return e.json(409, { error: "You can only rate a completed booking." });
    }

    let meta = {};
    try {
      const raw = booking.getString("metadata");
      // An unset JSON field reads back as the literal string "null" (and get()
      // returns a byte array), so JSON.parse yields null — never assign onto it.
      const parsed = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        meta = parsed;
      }
    } catch (mErr) {}

    const alreadyRated = !!meta.staff_reviewed_at;

    const nowIso = new Date().toISOString();
    meta.staff_rating = rating;
    meta.staff_review = feedback;
    meta.staff_reviewed_at = nowIso;
    booking.set("metadata", JSON.stringify(meta));
    $app.save(booking);

    // Sync to store_feedbacks
    const merchantId = booking.getString("merchant");
    const staffId = meta.staff_id || booking.getString("staff") || "";
    const staffName = meta.staff_name || "";
    const custPhone = booking.getString("customer_phone");
    const custName = booking.getString("customer_name");

    // Only write a feedback row on the FIRST rating. A re-rate updates the
    // booking metadata (so a mistake can be corrected) but must not inflate the
    // merchant's review count or the staff average.
    if (!alreadyRated) {
      try {
        const fbCol = $app.findCollectionByNameOrId("store_feedbacks");
        const fbRec = new Record(fbCol);
        fbRec.set("id", $security.randomString(15).toLowerCase());
        fbRec.set("merchant", merchantId);
        fbRec.set("customer_phone", custPhone);
        fbRec.set("customer_name", custName);
        fbRec.set("rating", rating);
        fbRec.set("feedback", feedback || (staffName ? "Servis oleh " + staffName : ""));
        fbRec.set("redirected_to_google", false);
        $app.save(fbRec);
      } catch (fbErr) {
        console.log("[RATE STAFF] Error writing store_feedbacks:", fbErr.message || fbErr);
      }
    }

    return e.json(200, {
      success: true,
      booking_id: bookingId,
      rating: rating,
      feedback: feedback,
      staff_id: staffId,
      reviewed_at: nowIso
    });
  } catch (err) {
    console.log("[RATE STAFF ERROR]", err.message || err);
    return e.json(500, { error: err.message || ("" + err) });
  }
});

// Auto-ensure commission_type and commission_rate fields exist on merchant_services upon bootstrap
onBootstrap((e) => {
  e.next();
  try {
    const col = $app.findCollectionByNameOrId("merchant_services");
    if (col) {
      let changed = false;
      let hasCommType = false;
      let hasCommRate = false;
      try { hasCommType = !!col.fields.getByName("commission_type"); } catch (fErr) {}
      try { hasCommRate = !!col.fields.getByName("commission_rate"); } catch (fErr) {}

      if (!hasCommType) {
        col.fields.add(new Field({
          "id": "sel_comm_type_srv",
          "name": "commission_type",
          "type": "select",
          "system": false,
          "required": false,
          "values": ["none", "percentage", "fixed"]
        }));
        changed = true;
      }

      if (!hasCommRate) {
        col.fields.add(new Field({
          "id": "num_comm_rate_srv",
          "name": "commission_rate",
          "type": "number",
          "system": false,
          "required": false
        }));
        changed = true;
      }

      if (changed) {
        $app.save(col);
        console.log("[BOOTSTRAP] Added commission_type & commission_rate to merchant_services");
      }
    }
  } catch (bErr) {
    console.log("[BOOTSTRAP MS NOTE]", bErr.message || bErr);
  }
});


