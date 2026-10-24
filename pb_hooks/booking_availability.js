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

// "08:00", "8:00 AM", "22:00" -> minutes since midnight. -1 when unparseable.
function parseClockMinutes(value) {
  var text = String(value === undefined || value === null ? "" : value).trim();
  if (!text) return -1;
  var ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text);
  if (ampm) {
    var h12 = parseInt(ampm[1], 10);
    var m12 = parseInt(ampm[2], 10);
    if (h12 < 1 || h12 > 12 || m12 < 0 || m12 > 59) return -1;
    if (ampm[3].toUpperCase() === "PM" && h12 < 12) h12 += 12;
    if (ampm[3].toUpperCase() === "AM" && h12 === 12) h12 = 0;
    return h12 * 60 + m12;
  }
  var plain = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (plain) {
    var h24 = parseInt(plain[1], 10);
    var m24 = parseInt(plain[2], 10);
    if (h24 < 0 || h24 > 23 || m24 < 0 || m24 > 59) return -1;
    return h24 * 60 + m24;
  }
  return -1;
}

// Opening window for one calendar day.
//
// `store_locations.hours` is stored in two shapes, both accepted here:
//   { "Monday": "08:00 - 22:00", ... }                      (text)
//   { "mon": { open: "08:00", close: "22:00", closed: false } } (object)
//
// Returns { unset, closed, openMinutes, closeMinutes }. `unset` means the
// merchant never configured hours, so callers must not block anything; a day
// missing from a configured week counts as closed. Overnight windows come back
// with closeMinutes > 1440.
function hoursForDate(hours, dateIso) {
  var result = { unset: false, closed: false, openMinutes: 0, closeMinutes: 0 };
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) {
    result.unset = true;
    return result;
  }
  var date = new Date(String(dateIso || "").trim() + "T00:00:00Z");
  if (isNaN(date.getTime())) {
    result.unset = true;
    return result;
  }

  var keys = Object.keys(hours);
  var lowered = {};
  var anyValue = false;
  for (var i = 0; i < keys.length; i++) {
    var value = hours[keys[i]];
    lowered[String(keys[i]).trim().toLowerCase()] = value;
    if (value !== undefined && value !== null && String(value).trim() !== "") anyValue = true;
  }
  if (!anyValue) {
    result.unset = true;
    return result;
  }

  var fullNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  var shortNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var dayIndex = date.getUTCDay();
  var raw = lowered[fullNames[dayIndex]];
  if (raw === undefined) raw = lowered[shortNames[dayIndex]];
  if (raw === undefined) {
    result.closed = true;
    return result;
  }

  var openText = "";
  var closeText = "";
  var explicitlyClosed = false;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    explicitlyClosed = raw.closed === true;
    openText = String(raw.open || "");
    closeText = String(raw.close || "");
  } else {
    var text = String(raw).trim();
    if (!text || /^(closed|tutup)$/i.test(text)) {
      explicitlyClosed = true;
    } else {
      var parts = text.split(/\s*(?:-|–|—|\bto\b)\s*/i);
      if (parts.length >= 2) {
        openText = parts[0];
        closeText = parts[1];
      }
    }
  }
  if (explicitlyClosed) {
    result.closed = true;
    return result;
  }

  var openMinutes = parseClockMinutes(openText);
  var closeMinutes = parseClockMinutes(closeText);
  // Malformed hours are treated as closed: never let a typo open the shop.
  if (openMinutes < 0 || closeMinutes < 0) {
    result.closed = true;
    return result;
  }
  if (closeMinutes <= openMinutes) closeMinutes += 1440;

  result.openMinutes = openMinutes;
  result.closeMinutes = closeMinutes;
  return result;
}

// Whether a service starting at startMinutes and lasting durationMinutes fits
// inside the day's window. Overnight windows shift a post-midnight start.
function fitsOpeningHours(day, startMinutes, durationMinutes) {
  if (!day || day.unset) return true;
  if (day.closed) return false;
  var start = startMinutes;
  if (day.closeMinutes > 1440 && start < day.openMinutes) start += 1440;
  if (start < day.openMinutes) return false;
  return start + Math.max(0, durationMinutes) <= day.closeMinutes;
}

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
  parseClockMinutes: parseClockMinutes,
  hoursForDate: hoursForDate,
  fitsOpeningHours: fitsOpeningHours,
};
