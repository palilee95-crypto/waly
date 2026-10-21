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

// Helper: Process completed service booking into transactions ledger, update loyalty stamps/points, and generate receipt
function processCompletedBooking(rec) {
  if (!rec) return null;
  var bookingId = rec.id;
  var merchantId = rec.getString ? rec.getString("merchant") : rec.get("merchant");
  if (!merchantId) return null;

  var totalPrice = parseFloat(rec.get("total_price")) || 0;
  var customerName = (rec.getString ? rec.getString("customer_name") : rec.get("customer_name")) || "Customer";
  var customerPhone = (rec.getString ? rec.getString("customer_phone") : rec.get("customer_phone")) || "";
  var branchId = rec.getString ? rec.getString("branch") : rec.get("branch");
  var staffId = rec.getString ? rec.getString("staff") : rec.get("staff");

  // 1. Idempotency Check: Don't create duplicate transaction for this booking
  try {
    var checkResult = new DynamicModel({ cnt: 0 });
    $app.db()
      .newQuery("SELECT COUNT(*) as cnt FROM transactions WHERE metadata LIKE {:pattern}")
      .bind({ pattern: `%"booking_id":"${bookingId}"%` })
      .one(checkResult);
    if (Number(checkResult.cnt) > 0) {
      console.log("[BOOKING COMPLETE] Transaction already exists for booking " + bookingId + ", skipping.");
      return null;
    }
  } catch (chkErr) {
    try {
      var existingTx = $app.findRecordsByFilter(
        "transactions",
        "merchant = '" + merchantId + "' && metadata ~ '\"booking_id\":\"" + bookingId + "\"'",
        "-created",
        1,
        0
      );
      if (existingTx && existingTx.length > 0) {
        console.log("[BOOKING COMPLETE] Transaction already exists for booking " + bookingId + " (" + existingTx[0].id + "), skipping.");
        return existingTx[0];
      }
    } catch (fbErr) {}
  }

  // 2. Resolve or provision customer
  var customerId = rec.getString ? rec.getString("customer") : rec.get("customer");
  var customer = null;
  if (customerId) {
    try { customer = $app.findRecordById("users", customerId); } catch (e) {}
  }
  if (!customer && customerPhone) {
    var cleanPhone = normalizePhone(customerPhone);
    customer = ensureCustomerAndLoyaltyCard(cleanPhone, customerName, merchantId);
  }
  if (!customer) {
    console.log("[BOOKING COMPLETE] Unable to resolve customer for booking " + bookingId);
    return null;
  }

  // Link customer on booking record if not linked
  if (!customerId && customer) {
    try {
      rec.set("customer", customer.id);
      $app.save(rec);
    } catch (linkErr) {}
  }

  // 3. Find merchant loyalty program
  var program = null;
  try {
    var progs = $app.findRecordsByFilter(
      "loyalty_programs",
      "merchant = '" + merchantId + "' && is_active = true",
      "-created",
      1,
      0
    );
    if (progs.length > 0) program = progs[0];
  } catch (pErr) {}

  var stampsToAward = 1;
  var pointsToAward = Math.floor(totalPrice);
  var programId = null;

  if (program) {
    programId = program.id;
    var isStampsEnabled = program.get("enable_stamps") !== false;
    var isPointsEnabled = program.get("enable_points") !== false;
    var spendPerPoint = parseFloat(program.get("spend_per_point")) || 1;

    if (!isStampsEnabled) stampsToAward = 0;
    if (!isPointsEnabled) pointsToAward = 0;
    else if (spendPerPoint > 0) {
      pointsToAward = Math.floor(totalPrice / spendPerPoint);
    }
  }

  // A POS checkout chooses its own stamp count; /api/risev/nfc/complete stores
  // it on the booking before completing it.
  try {
    var rawBookingMeta = (typeof rec.getString === "function") ? rec.getString("metadata") : "";
    if (rawBookingMeta && rawBookingMeta !== "null") {
      var parsedBookingMeta = JSON.parse(rawBookingMeta);
      var posStamps = parsedBookingMeta && parsedBookingMeta.pos_stamps;
      if (posStamps !== undefined && posStamps !== null && String(posStamps) !== "") {
        stampsToAward = Math.max(0, parseInt(String(posStamps), 10) || 0);
        if (program && program.get("enable_stamps") === false) stampsToAward = 0;
      }
    }
  } catch (posMetaErr) {}

  // 4. Resolve items summary
  var itemsSummary = [];
  try {
    var rawItemsStr = (typeof rec.getString === "function") ? rec.getString("items_summary") : "";
    if (rawItemsStr && typeof rawItemsStr === "string" && rawItemsStr.trim()) {
      itemsSummary = JSON.parse(rawItemsStr);
    } else {
      var rawVal = rec.get("items_summary");
      if (typeof rawVal === "string" && rawVal.trim()) {
        itemsSummary = JSON.parse(rawVal);
      } else if (Array.isArray(rawVal) && rawVal.length > 0 && typeof rawVal[0] === "number") {
        var str = "";
        for (var i = 0; i < rawVal.length; i++) str += String.fromCharCode(rawVal[i]);
        itemsSummary = JSON.parse(str);
      } else if (Array.isArray(rawVal)) {
        itemsSummary = rawVal;
      }
    }
  } catch (itErr) {
    itemsSummary = [];
  }
  var serviceNames = "Service Booking";
  if (Array.isArray(itemsSummary) && itemsSummary.length > 0) {
    serviceNames = itemsSummary.map(function(item) { return item.name || "Service"; }).join(", ");
  }

  // 5. Find or create loyalty card
  var loyaltyCard = null;
  try {
    var cards = $app.findRecordsByFilter(
      "loyalty_cards",
      "customer = '" + customer.id + "' && merchant = '" + merchantId + "'",
      "-created",
      1,
      0
    );
    if (cards.length > 0) {
      loyaltyCard = cards[0];
    } else {
      var cardCol = $app.findCollectionByNameOrId("loyalty_cards");
      loyaltyCard = new Record(cardCol);
      loyaltyCard.set("id", $security.randomString(15).toLowerCase());
      loyaltyCard.set("customer", customer.id);
      loyaltyCard.set("merchant", merchantId);
      if (programId) loyaltyCard.set("program", programId);
      loyaltyCard.set("stamps_collected", 0);
      loyaltyCard.set("completions", 0);
      loyaltyCard.set("status", "active");
      loyaltyCard.set("opt_in_marketing", true);
      $app.save(loyaltyCard);
    }
  } catch (cErr) {
    console.log("[BOOKING LOYALTY CARD RESOLVE ERROR]", cErr.message || cErr);
  }

  // 6. Resolve staff user ID and calculate commission
  var staffUserId = null;
  var staffName = "Staff";
  var staffRec = null;
  var staffUserRec = null;
  var commissionAmount = 0;

  if (staffId) {
    try {
      staffRec = $app.findRecordById("merchant_staff", staffId);
      if (staffRec) {
        staffUserId = staffRec.getString("user");
        staffName = staffRec.getString("name") || "Staff";
      }
    } catch (stErr) {}

    if (staffUserId) {
      try { staffUserRec = $app.findRecordById("users", staffUserId); } catch (uErr) {}
    } else {
      try {
        staffUserRec = $app.findRecordById("users", staffId);
        if (staffUserRec) {
          staffUserId = staffUserRec.id;
          staffName = staffUserRec.getString("name") || "Staff";
        }
      } catch (uErr) {}
    }

    // Commission Calculation
    try {
      var commType = "none";
      var commRate = 0;
      var empType = "full_time";

      if (staffUserRec) {
        commType = staffUserRec.getString("commission_type") || "none";
        commRate = parseFloat(staffUserRec.get("commission_rate")) || 0;
        empType = staffUserRec.getString("employment_type") || "full_time";
      } else if (staffRec) {
        commType = staffRec.getString("commission_type") || "none";
        commRate = parseFloat(staffRec.get("commission_rate")) || 0;
        empType = staffRec.getString("employment_type") || "full_time";
      }

      // 6.1 Per-Item Product & Service Commission Calculation
      var totalCommission = 0;
      var commissionBreakdown = [];
      var remainingServicePrice = 0;

      if (Array.isArray(itemsSummary) && itemsSummary.length > 0) {
        for (var i = 0; i < itemsSummary.length; i++) {
          var itm = itemsSummary[i];
          if (!itm) continue;
          var itmPrice = parseFloat(itm.price) || 0;
          var itmQty = parseInt(itm.quantity, 10) || 1;
          var itmLineTotal = itmPrice * itmQty;

          // Check if item has specific commission
          var itemCommType = itm.commission_type || "none";
          var itemCommRate = parseFloat(itm.commission_rate) || 0;

          // If not in summary, attempt lookup from merchant_services
          var itemId = itm.id || itm.service_id;
          if (itemId && itemCommType === "none") {
            try {
              var srvRec = $app.findRecordById("merchant_services", itemId);
              if (srvRec) {
                itemCommType = srvRec.getString("commission_type") || "none";
                itemCommRate = parseFloat(srvRec.get("commission_rate")) || 0;
              }
            } catch (srvErr) {}
          }

          var itmCommAmount = 0;
          if (itemCommType === "percentage") {
            itmCommAmount = Math.round((itmLineTotal * itemCommRate / 100) * 100) / 100;
          } else if (itemCommType === "fixed") {
            itmCommAmount = Math.round((itemCommRate * itmQty) * 100) / 100;
          }

          if (itmCommAmount > 0) {
            totalCommission += itmCommAmount;
            commissionBreakdown.push({
              name: itm.name || "Product",
              item_type: itm.item_type || "product",
              price: itmLineTotal,
              commission_type: itemCommType,
              commission_rate: itemCommRate,
              commission_amount: itmCommAmount
            });
          } else {
            // Accumulate for staff base commission
            remainingServicePrice += itmLineTotal;
          }
        }
      } else {
        remainingServicePrice = totalPrice;
      }

      // Base staff commission on remaining services
      var baseServiceCommission = 0;
      if (commType === "percentage") {
        baseServiceCommission = Math.round((remainingServicePrice * commRate / 100) * 100) / 100;
      } else if (commType === "fixed_per_job" && remainingServicePrice > 0) {
        baseServiceCommission = commRate;
      }

      if (baseServiceCommission > 0) {
        totalCommission += baseServiceCommission;
        commissionBreakdown.push({
          name: "Standard Service",
          item_type: "service",
          price: remainingServicePrice,
          commission_type: commType,
          commission_rate: commRate,
          commission_amount: baseServiceCommission
        });
      }

      commissionAmount = Math.round(totalCommission * 100) / 100;

      // Read current booking metadata
      var bMeta = {};
      try {
        var rawBM = rec.getString ? rec.getString("metadata") : "";
        bMeta = typeof rawBM === "string" && rawBM.trim() ? JSON.parse(rawBM) : (rec.get("metadata") || {});
      } catch (bmErr) { bMeta = {}; }
      if (!bMeta || typeof bMeta !== "object") bMeta = {};

      if (!bMeta.commission_calculated) {
        bMeta.commission_calculated = true;
        bMeta.staff_id = staffUserId || staffId;
        bMeta.staff_name = staffName;
        bMeta.employment_type = empType;
        bMeta.commission_type = commType;
        bMeta.commission_rate = commRate;
        bMeta.bill_amount = totalPrice;
        bMeta.commission_amount = commissionAmount;
        bMeta.commission_breakdown = commissionBreakdown;
        bMeta.commission_payout_status = bMeta.commission_payout_status || "unpaid";
        bMeta.commission_calculated_at = new Date().toISOString();

        rec.set("metadata", JSON.stringify(bMeta));
        try {
          $app.save(rec);
          console.log("[BOOKING COMPLETE] Commission snapshot saved for " + staffName + ": RM" + commissionAmount + " (" + commType + " " + commRate + ")");
        } catch (saveBmErr) {
          console.log("[BOOKING COMPLETE] Error saving commission snapshot:", saveBmErr.message || saveBmErr);
        }
      }
    } catch (commErr) {
      console.log("[COMMISSION CALCULATION ERROR]", commErr.message || commErr);
    }
  }

  // 7. Insert transaction record (Unified Sales Ledger)
  var newTx = null;
  try {
    var txCol = $app.findCollectionByNameOrId("transactions");
    newTx = new Record(txCol);
    newTx.set("id", $security.randomString(15).toLowerCase());
    newTx.set("customer", customer.id);
    newTx.set("merchant", merchantId);
    if (loyaltyCard) newTx.set("loyalty_card", loyaltyCard.id);
    if (staffUserId) newTx.set("staff", staffUserId);
    var safeBranchId = "";
    if (branchId) {
      try {
        var bRec = $app.findRecordById("branches", branchId);
        if (bRec && bRec.getString("merchant") === merchantId) safeBranchId = bRec.id;
      } catch (bRecErr) {}
    }
    if (safeBranchId) newTx.set("branch", safeBranchId);
    newTx.set("type", "earn");
    newTx.set("bill_amount", totalPrice);
    newTx.set("stamps", stampsToAward);
    newTx.set("points", pointsToAward);

    var txnMeta = {
      source: "booking",
      booking_id: bookingId,
      customer_name: customerName,
      customer_phone: customerPhone,
      branch_id: branchId || "",
      staff_id: staffId || "",
      items_summary: itemsSummary || [],
      notes: "Booking completed: " + serviceNames,
      commission_amount: commissionAmount
    };
    newTx.set("metadata", JSON.stringify(txnMeta));
    $app.save(newTx);
    console.log("[BOOKING COMPLETE] Transaction created " + newTx.id + " for customer " + customer.id + ": RM" + totalPrice + ", +" + stampsToAward + " stamps");
  } catch (txErr) {
    console.log("[BOOKING TRANSACTION ERROR]", txErr.message || txErr);
    newTx = null;
  }

  // 8. Update customer loyalty card stamps (triggers stamp_complete.pb.js)
  if (loyaltyCard && stampsToAward > 0) {
    try {
      var currStamps = parseInt(loyaltyCard.get("stamps_collected")) || 0;
      loyaltyCard.set("stamps_collected", currStamps + stampsToAward);
      loyaltyCard.set("last_activity", new Date().toISOString().replace("T", " ").substring(0, 19));
      $app.save(loyaltyCard);
      console.log("[BOOKING COMPLETE] Loyalty card " + loyaltyCard.id + " updated to " + (currStamps + stampsToAward) + " stamps");
    } catch (cardUpErr) {
      console.log("[BOOKING CARD UPDATE ERROR]", cardUpErr.message || cardUpErr);
    }
  }

  // 9. Update customer total points
  if (pointsToAward > 0) {
    try {
      var currPoints = parseInt(customer.get("total_points")) || 0;
      customer.set("total_points", currPoints + pointsToAward);
      $app.save(customer);
    } catch (ptErr) {
      console.log("[BOOKING POINTS UPDATE ERROR]", ptErr.message || ptErr);
    }
  }

  // 10. Generate digital receipt
  try {
    if (!newTx || totalPrice <= 0) return newTx;
    var receiptMeta = {};
    try {
      // An unset JSON field reads back as the literal string "null", and
      // JSON.parse("null") is null — assigning it would throw on the first
      // property read and abort the receipt.
      var receiptMetaRaw = rec.getString ? rec.getString("metadata") : "";
      var parsedMeta = receiptMetaRaw && receiptMetaRaw !== "null" ? JSON.parse(receiptMetaRaw) : null;
      if (parsedMeta && typeof parsedMeta === "object" && !Array.isArray(parsedMeta)) receiptMeta = parsedMeta;
    } catch (metaErr) { receiptMeta = {}; }
    var dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    var receiptCode = "REC-" + dateStr + "-" + $security.randomString(4).toUpperCase();

    var recCol = $app.findCollectionByNameOrId("digital_receipts");
    if (recCol) {
      var digitalReceipt = new Record(recCol);
      digitalReceipt.set("id", $security.randomString(15).toLowerCase());
      digitalReceipt.set("merchant", merchantId);
      digitalReceipt.set("booking", bookingId);
      if (receiptMeta.pos_claim_id) digitalReceipt.set("claim", receiptMeta.pos_claim_id);
      digitalReceipt.set("transaction", newTx.id);
      digitalReceipt.set("customer", customer.id);
      digitalReceipt.set("customer_phone", customer.getString("phone") || customerPhone);
      digitalReceipt.set("customer_name", customerName);
      digitalReceipt.set("staff_name", staffName || "");
      var receiptBranchName = "";
      if (branchId) {
        try {
          var receiptBranch = $app.findRecordById("branches", branchId);
          if (receiptBranch.getString("merchant") === merchantId) {
            receiptBranchName = receiptBranch.getString("name") || receiptBranch.getString("branch_name") || "";
          }
        } catch (branchErr) {}
      }
      digitalReceipt.set("branch_name", receiptBranchName);
      digitalReceipt.set("receipt_number", receiptCode);
      digitalReceipt.set("line_items", itemsSummary || []);
      digitalReceipt.set("subtotal", Number(receiptMeta.subtotal) || totalPrice);
      digitalReceipt.set("discount_amount", Number(receiptMeta.discount_amount) || 0);
      digitalReceipt.set("total_amount", totalPrice);
      digitalReceipt.set("payment_method", receiptMeta.payment_method || "Store Counter");
      digitalReceipt.set("payment_reference", receiptMeta.payment_reference || "");
      digitalReceipt.set("payment_status", receiptMeta.pos_claim_id ? "paid" : "recorded");
      digitalReceipt.set("stamps_earned", stampsToAward);
      $app.save(digitalReceipt);
      console.log("[BOOKING COMPLETE] Digital receipt generated: " + receiptCode);
    }
  } catch (rErr) {
    console.log("[DIGITAL RECEIPT ERROR]", rErr.message || rErr);
  }

  return newTx;
}

module.exports = {
  parseTimeToMinutes,
  formatMinutesToTime,
  normalizePhone,
  checkMerchantBookingAccess,
  ensureCustomerAndLoyaltyCard,
  processCompletedBooking
};
