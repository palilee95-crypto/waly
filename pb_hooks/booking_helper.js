// pb_hooks/booking_helper.js
// Shared helpers for Risev Booking System (JSVM / Goja safe)

// Helper: Convert time string ("11:00 AM", "14:30") to minutes from midnight
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

// Helper: Convert minutes from midnight back to "HH:mm"
function formatMinutesToTime(mins) {
  mins = ((mins % 1440) + 1440) % 1440;
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  var hPad = h < 10 ? "0" + h : "" + h;
  var mPad = m < 10 ? "0" + m : "" + m;
  return hPad + ":" + mPad;
}

// Helper: Standardize Malaysian phone number (+601...)
function normalizePhone(rawPhone) {
  if (!rawPhone) return "";
  var digits = ("" + rawPhone).replace(/[^\d]/g, "");
  if (digits.startsWith("0")) digits = "6" + digits;
  if (!digits.startsWith("60") && digits.length >= 9) digits = "60" + digits;
  return "+" + digits;
}

// Helper: Verify merchant has active PRO plan or has_booking_addon = true
function checkMerchantBookingAccess(merchantId) {
  if (!merchantId) return false;
  try {
    var merchant = $app.findRecordById("merchants", merchantId);
    if (!merchant) return false;

    // Check direct addon flag
    if (merchant.getBool("has_booking_addon") === true) {
      var meta = merchant.get("metadata") || {};
      if (meta.booking_trial_ends_at) {
        var endTime = new Date(meta.booking_trial_ends_at).getTime();
        if (endTime > Date.now()) {
          return true;
        }
        // Trial has ended, proceed below to verify if merchant upgraded to PRO
      } else {
        return true;
      }
    }

    // Check active PRO subscription
    var subs = $app.findRecordsByFilter(
      "subscriptions",
      `merchant = "${merchantId}" && (status = "active" || status = "trialing")`,
      "-created",
      1,
      0
    );
    if (subs.length > 0) {
      var plan = (subs[0].getString("plan") || "").toLowerCase();
      if (plan === "pro" || plan === "business") {
        return true;
      }
    }
  } catch (err) {
    console.log("[BOOKING ACCESS CHECK ERROR]", err.message || err);
  }
  return false;
}

// Helper: Find or provision customer in users collection + loyalty card
function ensureCustomerAndLoyaltyCard(cleanPhone, customerName, merchantId) {
  if (!cleanPhone || !merchantId) return null;
  var digits = cleanPhone.replace(/[^\d]/g, "");
  var localDigits = digits.startsWith("60") ? "0" + digits.slice(2) : digits;

  var customer = null;
  try {
    var phoneFilter = `phone = '${cleanPhone}' || phone = '${digits}' || phone = '${localDigits}'`;
    var users = $app.findRecordsByFilter("users", phoneFilter, "-created", 1, 0);
    if (users.length > 0) customer = users[0];
  } catch (err) {}

  if (!customer) {
    try {
      var userCol = $app.findCollectionByNameOrId("users");
      customer = new Record(userCol);
      customer.set("id", $security.randomString(15).toLowerCase());
      customer.set("phone", cleanPhone);
      customer.set("email", `shadow_cust_${digits}@risev.app`);
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

  // Ensure customer has loyalty card for this merchant
  if (customer) {
    try {
      var cards = $app.findRecordsByFilter(
        "loyalty_cards",
        `customer = '${customer.id}' && merchant = '${merchantId}'`,
        "created",
        1,
        0
      );
      if (cards.length === 0) {
        var programId = null;
        try {
          var progs = $app.findRecordsByFilter(
            "loyalty_programs",
            `merchant = '${merchantId}' && is_active = true`,
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

module.exports = {
  parseTimeToMinutes,
  formatMinutesToTime,
  normalizePhone,
  checkMerchantBookingAccess,
  ensureCustomerAndLoyaltyCard
};
