// pb_hooks/booking_reminders_logic.js
// Automated processor for upcoming customer booking reminders (12 hours, 3 hours, 30 minutes before)
// Pure Web Push (RFC 8291), 100% independent of WhatsApp / Meta API.

function parseBookingDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const dateParts = dateStr.trim().split('-');
  if (dateParts.length !== 3) return null;
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  let hours = 9;
  let minutes = 0;

  if (timeStr) {
    const raw = timeStr.trim();
    const isPM = /pm/i.test(raw);
    const isAM = /am/i.test(raw);
    const cleanTime = raw.replace(/[^\d:]/g, '');
    const timeParts = cleanTime.split(':');
    if (timeParts.length >= 1) {
      hours = parseInt(timeParts[0], 10);
      minutes = timeParts.length >= 2 ? parseInt(timeParts[1], 10) : 0;
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}

function processBookingReminders() {
  const pushHelper = require(`${__hooks}/push_notify.js`);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Check bookings for today and tomorrow
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  let bookings = [];
  try {
    bookings = $app.findRecordsByFilter(
      "service_bookings",
      `status = "booked" && (booking_date = "${todayStr}" || booking_date = "${tomorrowStr}")`,
      "booking_date,start_time",
      100,
      0
    );
  } catch (err) {
    console.log("[BOOKING REMINDERS] Query note:", err.message || err);
    return { error: err.message, processed: 0 };
  }

  const results = {
    evaluated: bookings.length,
    sent12h: 0,
    sent3h: 0,
    sent30m: 0,
    skipped: 0
  };

  bookings.forEach(function(booking) {
    const bDateStr = booking.getString("booking_date");
    const bTimeStr = booking.getString("start_time");
    const bDateTime = parseBookingDateTime(bDateStr, bTimeStr);

    if (!bDateTime) {
      results.skipped++;
      return;
    }

    const diffMs = bDateTime.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (60 * 1000));

    // If appointment has passed by more than 15 minutes, skip
    if (diffMinutes < -15) {
      results.skipped++;
      return;
    }

    // Get current reminders_sent array
    let remindersSent = [];
    try {
      const rawReminders = booking.get("reminders_sent");
      if (Array.isArray(rawReminders)) {
        remindersSent = rawReminders;
      } else if (typeof rawReminders === "string" && rawReminders.trim()) {
        remindersSent = JSON.parse(rawReminders);
      }
    } catch (e) {
      remindersSent = [];
    }

    const customerPhone = booking.getString("customer_phone");
    const customerId = booking.getString("customer");
    const merchantId = booking.getString("merchant");

    // Fetch merchant name & slug for personalized push message & URL
    let merchantName = "Kedai";
    let merchantSlug = "";
    if (merchantId) {
      try {
        const mRec = $app.findRecordById("merchants", merchantId);
        merchantName = mRec.getString("name") || "Kedai";
        merchantSlug = mRec.getString("slug") || "";
      } catch (mErr) {}
    }

    // Fetch primary service title
    let serviceTitle = "Servis";
    try {
      const items = booking.get("items_summary");
      if (Array.isArray(items) && items.length > 0 && items[0].name) {
        serviceTitle = items[0].name;
      }
    } catch (itErr) {}

    const targetUrl = merchantSlug ? `/b/${merchantSlug}` : '/(customer)';
    let needSave = false;

    // ── 1. REMINDER: 12 Hours Before (Window: 660m to 750m) ──
    if (diffMinutes >= 660 && diffMinutes <= 750 && remindersSent.indexOf("12h") === -1) {
      const payload = {
        title: `Peringatan Temujanji: 12 Jam Lagi ⏰`,
        body: `Temujanji [${serviceTitle}] anda di ${merchantName} pada ${bTimeStr}. Sedia berjumpa anda!`,
        url: targetUrl,
        tag: `booking-12h-${booking.id}`,
        renotify: true
      };

      pushHelper.sendPushToCustomer(customerId, customerPhone, payload);
      remindersSent.push("12h");
      needSave = true;
      results.sent12h++;
      console.log(`[BOOKING REMINDER 12H] Sent for booking ${booking.id} to ${customerPhone || customerId}`);
    }

    // ── 2. REMINDER: 3 Hours Before (Window: 150m to 210m) ──
    if (diffMinutes >= 150 && diffMinutes <= 210 && remindersSent.indexOf("3h") === -1) {
      const payload = {
        title: `3 Jam Lagi! Bersiap Sedia 💈`,
        body: `Slot [${serviceTitle}] anda di ${merchantName} bermula jam ${bTimeStr}. Sila tiba 5-10 minit awal.`,
        url: targetUrl,
        tag: `booking-3h-${booking.id}`,
        renotify: true
      };

      pushHelper.sendPushToCustomer(customerId, customerPhone, payload);
      remindersSent.push("3h");
      needSave = true;
      results.sent3h++;
      console.log(`[BOOKING REMINDER 3H] Sent for booking ${booking.id} to ${customerPhone || customerId}`);
    }

    // ── 3. REMINDER: 30 Minutes Before (Window: 15m to 45m) ──
    if (diffMinutes >= 15 && diffMinutes <= 45 && remindersSent.indexOf("30m") === -1) {
      const payload = {
        title: `Giliran Anda 30 Minit Lagi! 🚗`,
        body: `Temujanji di ${merchantName} jam ${bTimeStr}. Buka untuk semak tiket & arah perjalanan.`,
        url: targetUrl,
        tag: `booking-30m-${booking.id}`,
        renotify: true
      };

      pushHelper.sendPushToCustomer(customerId, customerPhone, payload);
      remindersSent.push("30m");
      needSave = true;
      results.sent30m++;
      console.log(`[BOOKING REMINDER 30M] Sent for booking ${booking.id} to ${customerPhone || customerId}`);
    }

    if (needSave) {
      try {
        booking.set("reminders_sent", remindersSent);
        $app.save(booking);
      } catch (saveErr) {
        console.log(`[BOOKING REMINDER SAVE ERROR] Booking ${booking.id}:`, saveErr.message || saveErr);
      }
    }
  });

  return results;
}

module.exports = {
  processBookingReminders,
  parseBookingDateTime
};
