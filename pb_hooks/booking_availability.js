// Booking availability helpers shared by the merchant reschedule route.
//
// A required module, not file scope: PocketBase JSVM handlers cannot see
// file-level declarations (see AGENTS.md).

// "03:00 PM" -> 900 minutes. Returns 0 for anything that is not a well-formed
// 12-hour slot with real hour/minute ranges, so callers can treat 0 as invalid.
function toMinutes(slot) {
  var match = /^([0-9]{1,2}):([0-9]{2})\s*(AM|PM)$/i.exec(String(slot || "").trim());
  if (!match) return 0;
  var hours = parseInt(match[1], 10);
  var minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return 0;
  var modifier = match[3].toUpperCase();
  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// A real calendar day in "YYYY-MM-DD" form (rejects 2026-99-99 and friends).
function isValidIsoDate(value) {
  var string = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(string)) return false;
  var parts = string.split("-");
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var day = parseInt(parts[2], 10);
  var date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
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

// The turnaround booking creation reserves after every appointment. Conflict
// windows use it on both sides: an existing visit occupies its service time
// plus this buffer, and callers pass the requested slot's buffered end.
var TURNAROUND_MINUTES = 10;

// The first active booking whose buffered window overlaps the requested
// buffered window for this staff member. A `null` result means the query ran
// and found no overlap; a failed query throws, so callers cannot mistake an
// unverified slot for a free one.
function findStaffConflict(merchantId, staffId, date, startMinutes, endMinutes, excludeId) {
  if (!staffId) return null;
  var records = $app.findRecordsByFilter(
    "service_bookings",
    "merchant = '" + merchantId + "' && staff = '" + staffId + "' && booking_date ~ '" + date + "' && (status = 'booked' || status = 'arrived' || status = 'in_service')",
    "start_time",
    200,
    0
  );
  for (var i = 0; i < records.length; i++) {
    var rec = records[i];
    if (excludeId && rec.id === excludeId) continue;
    var otherStart = toMinutes(rec.getString("start_time"));
    if (!otherStart) continue;
    var otherEnd = otherStart + durationMinutes(rec) + TURNAROUND_MINUTES;
    if (startMinutes < otherEnd && otherStart < endMinutes) return rec;
  }
  return null;
}

module.exports = {
  toMinutes: toMinutes,
  isValidIsoDate: isValidIsoDate,
  formatMinutes: formatMinutes,
  durationMinutes: durationMinutes,
  findStaffConflict: findStaffConflict,
};
