// pb_hooks/booking_pass_helper.js
// Shared helpers for the customer appointment pass (JSVM / Goja safe).
//
// Kept separate from booking_helper.js so the pass routes can validate
// ownership the same way everywhere without pulling in the completion engine.

function digitsOf(value) {
  return ("" + (value || "")).replace(/[^\d]/g, "");
}

// Standardise a Malaysian phone number to +60XXXXXXXXX.
function normalizePhone(rawPhone) {
  var digits = digitsOf(rawPhone);
  if (!digits) return "";
  if (digits.startsWith("0")) digits = "6" + digits;
  if (!digits.startsWith("60") && digits.length >= 9) digits = "60" + digits;
  return "+" + digits;
}

// Store-local (MYT) calendar day. booking_date is a plain "YYYY-MM-DD" string
// chosen in store time, so never compare it with a UTC date.
function storeTodayIso() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().substring(0, 10);
}

// An unset JSON field reads back as the literal string "null" and get()
// returns a byte array, so read with getString() + a guarded parse.
function readMetadata(rec) {
  var meta = {};
  try {
    var raw = typeof rec.getString === "function" ? rec.getString("metadata") : "";
    if (raw && raw !== "null") {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed;
    }
  } catch (err) {}
  return meta;
}

function readItems(rec) {
  var items = [];
  try {
    var raw = typeof rec.getString === "function" ? rec.getString("items_summary") : "";
    if (raw && raw !== "null") {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed;
    }
  } catch (err) {}
  return items;
}

// A booking belongs to the caller when it is linked to their account, or when
// the authenticated phone matches the booking phone. The id alone is never proof.
function isBookingCustomer(booking, authRecord) {
  if (!booking || !authRecord) return false;
  var linked = booking.getString("customer");
  if (linked && linked === authRecord.id) return true;

  var bookingDigits = digitsOf(booking.getString("customer_phone"));
  var authDigits = digitsOf(authRecord.getString ? authRecord.getString("phone") : "");
  return !!bookingDigits && bookingDigits === authDigits;
}

function buildPassPayload(booking) {
  var merchantId = booking.getString("merchant");
  var branchId = booking.getString("branch");
  var staffId = booking.getString("staff");

  var merchantName = "";
  var merchantSlug = "";
  if (merchantId) {
    try {
      var merchant = $app.findRecordById("merchants", merchantId);
      merchantName = merchant.getString("name");
      merchantSlug = merchant.getString("pwa_slug");
    } catch (mErr) {}
  }

  var branchName = "";
  if (branchId) {
    try {
      branchName = $app.findRecordById("branches", branchId).getString("name");
    } catch (bErr) {}
  }

  var staffName = "";
  if (staffId) {
    try {
      staffName = $app.findRecordById("merchant_staff", staffId).getString("name");
    } catch (sErr) {}
  }

  var meta = readMetadata(booking);
  var total = 0;
  try {
    total = typeof booking.getFloat === "function" ? booking.getFloat("total_price") : 0;
  } catch (pErr) {}

  return {
    id: booking.id,
    status: booking.getString("status"),
    merchant_id: merchantId,
    merchant_name: merchantName,
    merchant_slug: merchantSlug,
    branch_id: branchId,
    branch_name: branchName,
    staff_id: staffId,
    staff_name: staffName,
    booking_date: booking.getString("booking_date"),
    start_time: booking.getString("start_time"),
    end_time: booking.getString("end_time"),
    items_summary: readItems(booking),
    total_price: total,
    notes: booking.getString("notes"),
    customer_name: booking.getString("customer_name"),
    customer_phone: booking.getString("customer_phone"),
    arrived_at: meta.arrived_at || "",
  };
}

module.exports = {
  digitsOf: digitsOf,
  normalizePhone: normalizePhone,
  storeTodayIso: storeTodayIso,
  readMetadata: readMetadata,
  isBookingCustomer: isBookingCustomer,
  buildPassPayload: buildPassPayload,
};
