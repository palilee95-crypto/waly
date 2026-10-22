// Booking availability helpers shared by the merchant reschedule route.
//
// A required module, not file scope: PocketBase JSVM handlers cannot see
// file-level declarations (see AGENTS.md).

// "03:00 PM" -> 900 minutes. Returns 0 for an unparseable value.
function toMinutes(slot) {
  var value = String(slot || "").trim();
  if (!value) return 0;
  var parts = value.split(/\s+/);
  var timePart = parts[0] || "";
  var modifier = (parts[1] || "").toUpperCase();
  var hm = timePart.split(":");
  var hours = parseInt(hm[0], 10);
  var minutes = parseInt(hm[1], 10) || 0;
  if (isNaN(hours)) return 0;
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function formatMinutes(total) {
  var normalized = ((total % 1440) + 1440) % 1440;
  var hours24 = Math.floor(normalized / 60);
  var minutes = normalized % 60;
  var modifier = hours24 >= 12 ? "PM" : "AM";
  var hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return (hours12 < 10 ? "0" : "") + hours12 + ":" + (minutes < 10 ? "0" : "") + minutes + " " + modifier;
}

// Sum of the booked services' durations; 30 minutes when none are recorded.
function durationMinutes(booking) {
  var items = [];
  try {
    var raw = typeof booking.getString === "function" ? booking.getString("items_summary") : "";
    if (raw && raw !== "null") {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed;
    }
  } catch (err) {}
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += Math.max(0, parseInt(items[i] && items[i].duration_minutes, 10) || 0);
  }
  return total > 0 ? total : 30;
}

// The first active booking that overlaps the requested window for this staff
// member, or null. Overlap, not equality: a 90-minute service blocks the slots
// its duration covers.
function findStaffConflict(merchantId, staffId, date, startMinutes, endMinutes, excludeId) {
  if (!staffId) return null;
  var records = [];
  try {
    records = $app.findRecordsByFilter(
      "service_bookings",
      "merchant = '" + merchantId + "' && staff = '" + staffId + "' && booking_date ~ '" + date + "' && (status = 'booked' || status = 'arrived' || status = 'in_service')",
      "start_time",
      200,
      0
    );
  } catch (err) {
    return null;
  }
  for (var i = 0; i < records.length; i++) {
    var rec = records[i];
    if (excludeId && rec.id === excludeId) continue;
    var otherStart = toMinutes(rec.getString("start_time"));
    if (!otherStart) continue;
    var otherEnd = otherStart + durationMinutes(rec);
    if (startMinutes < otherEnd && otherStart < endMinutes) return rec;
  }
  return null;
}

module.exports = {
  toMinutes: toMinutes,
  formatMinutes: formatMinutes,
  durationMinutes: durationMinutes,
  findStaffConflict: findStaffConflict,
};
