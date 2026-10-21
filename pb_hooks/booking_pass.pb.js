// pb_hooks/booking_pass.pb.js
// Customer appointment pass: read the pass, self check-in, and the
// merchant-side resolver used by the POS scanner.
//
// Every handler declares its own locals — JSVM handlers do not see file-level
// declarations (see AGENTS.md), only required modules.

// -------------------------------------------------------------
// 1. Customer — read the pass (login required)
// -------------------------------------------------------------
routerAdd("GET", "/api/risev/booking/pass", (e) => {
  try {
    const helper = require(`${__hooks}/booking_pass_helper.js`);

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

    const auth = e.auth;
    if (!auth) {
      return e.json(401, { code: "AUTH_REQUIRED", message: "Log in to view your appointment pass." });
    }

    const bookingId = String(query.booking_id || query.id || "").trim();
    if (!bookingId) {
      return e.json(400, { code: "BOOKING_ID_REQUIRED", message: "Missing booking id." });
    }

    let booking = null;
    try {
      booking = $app.findRecordById("service_bookings", bookingId);
    } catch (bErr) {
      booking = null;
    }
    if (!booking) {
      return e.json(404, { code: "BOOKING_NOT_FOUND", message: "Booking not found." });
    }

    if (!helper.isBookingCustomer(booking, auth)) {
      return e.json(403, { code: "PASS_FORBIDDEN", message: "This pass belongs to a different customer." });
    }

    return e.json(200, { booking: helper.buildPassPayload(booking) });
  } catch (err) {
    console.log("[BOOKING PASS ERROR]", err.message || err);
    return e.json(500, { code: "PASS_ERROR", message: "Could not load the pass." });
  }
});

// -------------------------------------------------------------
// 2. Customer — self check-in (login required, same store day)
// -------------------------------------------------------------
routerAdd("POST", "/api/risev/booking/check-in", (e) => {
  try {
    const helper = require(`${__hooks}/booking_pass_helper.js`);

    let body = {};
    try {
      body = e.requestInfo().body || {};
    } catch (bErr) {
      try {
        body = $apis.requestInfo(e).body || {};
      } catch (bErr2) {
        body = {};
      }
    }

    const auth = e.auth;
    if (!auth) {
      return e.json(401, { code: "AUTH_REQUIRED", message: "Log in to check in." });
    }

    const bookingId = String(body.booking_id || body.id || "").trim();
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

    if (!helper.isBookingCustomer(booking, auth)) {
      return e.json(403, { code: "PASS_FORBIDDEN", message: "This pass belongs to a different customer." });
    }

    const status = booking.getString("status");

    // Already here: arrived (or already being served) is a success, not an error.
    if (status === "arrived" || status === "in_service") {
      return e.json(200, {
        already: true,
        status: status,
        booking: helper.buildPassPayload(booking),
      });
    }

    if (status === "completed" || status === "cancelled" || status === "no_show") {
      return e.json(409, {
        code: "BOOKING_NOT_ACTIVE",
        message: "This booking is already " + status.replace("_", " ") + ".",
        status: status,
      });
    }

    if (status !== "booked") {
      return e.json(409, { code: "BOOKING_NOT_ACTIVE", message: "This booking cannot be checked in." });
    }

    const today = helper.storeTodayIso();
    if (booking.getString("booking_date") !== today) {
      return e.json(409, {
        code: "BOOKING_NOT_TODAY",
        message: "You can only check in on the day of your appointment.",
        booking_date: booking.getString("booking_date"),
        today: today,
      });
    }

    let meta = helper.readMetadata(booking);
    meta.arrived_at = new Date().toISOString();
    meta.arrived_via = "pass";
    booking.set("metadata", JSON.stringify(meta));
    booking.set("status", "arrived");
    $app.save(booking);

    return e.json(200, {
      already: false,
      status: "arrived",
      booking: helper.buildPassPayload(booking),
    });
  } catch (err) {
    console.log("[BOOKING CHECK-IN ERROR]", err.message || err);
    return e.json(500, { code: "CHECK_IN_ERROR", message: "Could not check in right now." });
  }
});

// -------------------------------------------------------------
// 3. Merchant — resolve a scanned pass QR for the POS
// -------------------------------------------------------------
routerAdd("POST", "/api/risev/merchant/booking-pass", (e) => {
  try {
    const helper = require(`${__hooks}/booking_pass_helper.js`);

    let body = {};
    try {
      body = e.requestInfo().body || {};
    } catch (bErr) {
      try {
        body = $apis.requestInfo(e).body || {};
      } catch (bErr2) {
        body = {};
      }
    }

    const auth = e.auth;
    if (!auth) {
      return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in as the merchant to scan a pass." });
    }

    const bookingId = String(body.booking_id || body.id || "").trim();
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

    const status = booking.getString("status");
    if (status === "completed" || status === "cancelled" || status === "no_show") {
      return e.json(409, {
        code: "BOOKING_NOT_ACTIVE",
        message: "This booking is already " + status.replace("_", " ") + ".",
        status: status,
      });
    }

    return e.json(200, { booking: helper.buildPassPayload(booking) });
  } catch (err) {
    console.log("[MERCHANT BOOKING PASS ERROR]", err.message || err);
    return e.json(500, { code: "BOOKING_PASS_ERROR", message: "Could not load that booking." });
  }
});
