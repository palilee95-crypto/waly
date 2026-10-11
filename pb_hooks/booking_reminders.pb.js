// pb_hooks/booking_reminders.pb.js
// Automated background cron job & lifecycle events for customer booking push notifications
// Pure Web Push (RFC 8291), 100% independent of WhatsApp / Meta API.

// 1. Cron Job: Runs every 5 minutes to check and dispatch 12h, 3h, and 30m reminders
cronAdd("customer_booking_reminders", "*/5 * * * *", () => {
  try {
    const { processBookingReminders } = require(`${__hooks}/booking_reminders_logic.js`);
    const res = processBookingReminders();
    if (res && (res.sent2h > 0 || res.sent30m > 0)) {
      console.log("[BOOKING REMINDERS CRON] Sent:", JSON.stringify(res));
    }
  } catch (err) {
    console.log("[BOOKING REMINDERS CRON ERROR]:", err.message || err);
  }
});

// 2. Direct HTTP endpoint to manually trigger and verify booking reminders
routerAdd("GET", "/api/risev/test/run-booking-reminders", (e) => {
  try {
    const { processBookingReminders } = require(`${__hooks}/booking_reminders_logic.js`);
    const results = processBookingReminders();
    return e.json(200, {
      success: true,
      message: "Booking reminders processed successfully",
      data: results
    });
  } catch (err) {
    return e.json(500, {
      success: false,
      message: err.message || "Failed to process booking reminders"
    });
  }
});

// 3. Instant Push on Booking Creation: Send immediate booking confirmation push notification
onRecordCreate((e) => {
  e.next();
  try {
    const booking = e.record;
    if (!booking) return;

    const pushHelper = require(`${__hooks}/push_notify.js`);
    const customerPhone = booking.getString("customer_phone");
    const customerId = booking.getString("customer");
    const merchantId = booking.getString("merchant");
    const bDateStr = booking.getString("booking_date");
    const bTimeStr = booking.getString("start_time");

    let merchantName = "Kedai";
    let merchantSlug = "";
    if (merchantId) {
      try {
        const mRec = $app.findRecordById("merchants", merchantId);
        merchantName = mRec.getString("name") || "Kedai";
        merchantSlug = mRec.getString("slug") || "";
      } catch (mErr) {}
    }

    let serviceTitle = "Servis";
    try {
      let items = booking.get("items_summary");
      if (typeof items === "string") {
        try { items = JSON.parse(items); } catch (_) {}
      }
      if (Array.isArray(items) && items.length > 0 && items[0] && items[0].name) {
        serviceTitle = items[0].name;
      }
    } catch (itErr) {}

    const payload = {
      title: `Tempahan Berjaya Disahkan! 🎉`,
      body: `Slot [${serviceTitle}] anda di ${merchantName} pada ${bDateStr} jam ${bTimeStr} telah disahkan.`,
      url: merchantSlug ? `/b/${merchantSlug}` : '/(customer)',
      tag: `booking-created-${booking.id}`,
      renotify: true
    };

    pushHelper.sendPushToCustomer(customerId, customerPhone, payload);
    console.log(`[INSTANT BOOKING PUSH] Sent confirmation push for booking ${booking.id} to ${customerPhone || customerId}`);
  } catch (err) {
    console.log("[INSTANT BOOKING PUSH ERROR]:", err.message || err);
  }
}, "service_bookings");

