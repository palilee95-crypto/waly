// Public slot availability for the booking PWA.
//
// The page offered every slot in ALL_TIME_SLOTS, so a customer could only learn
// that their provider was busy when `service_bookings` rejected the create. This
// route exposes the provider's busy windows for a day (times only — no customer
// data) so the grid can disable them before the customer commits.
routerAdd("GET", "/api/risev/booking/availability", (e) => {
  try {
    const availability = require(`${__hooks}/booking_availability.js`);
    const query = e.requestInfo().query || {};
    const slug = String(query.slug || "").trim();
    const date = String(query.date || "").trim();
    const staff = String(query.staff || "").trim();

    if (!slug) return e.json(400, { code: "SLUG_REQUIRED", message: "A store is required." });
    if (!availability.isValidIsoDate(date)) {
      return e.json(400, { code: "DATE_INVALID", message: "Choose a valid date." });
    }

    let merchant = null;
    try {
      const found = $app.findRecordsByFilter("merchants", "pwa_slug = '" + slug + "'", "created", 1, 0);
      merchant = found.length ? found[0] : null;
    } catch (merchantErr) {
      merchant = null;
    }
    if (!merchant) return e.json(404, { code: "MERCHANT_NOT_FOUND", message: "Store not found." });

    // Same active statuses as the create-time overlap check.
    let filter =
      "merchant = '" + merchant.id + "' && booking_date ~ '" + date + "'" +
      " && (status = 'booked' || status = 'arrived' || status = 'in_service')";
    if (staff) filter += " && staff = '" + staff + "'";

    const records = $app.findRecordsByFilter("service_bookings", filter, "start_time", 200, 0);
    const busy = [];
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const start = availability.toMinutes(rec.getString("start_time"));
      if (!start) continue;
      const end = start + availability.durationMinutes(rec) + 10;
      busy.push({
        id: rec.id,
        staff: rec.getString("staff") || "",
        start_minutes: start,
        end_minutes: end,
      });
    }

    return e.json(200, { date: date, turnaround_minutes: 10, busy: busy });
  } catch (err) {
    console.log("[BOOKING AVAILABILITY] failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "AVAILABILITY_FAILED", message: "Could not load availability." });
  }
});
