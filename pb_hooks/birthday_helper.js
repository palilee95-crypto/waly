/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/birthday_helper.js
// Daily birthday reward automation (in-app voucher / bonus stamps + web push).
//
// Rules this file enforces:
//  - Only verified, non-shadow customers (shadow/quick accounts never logged in).
//  - One birthday per customer per merchant per calendar year, guarded by
//    idx_birthday_logs_unique (customer, merchant, year).
//  - The voucher links to a dedicated `rewards` record with reward_scope
//    "system", so it shows the right gift and never appears as a redeemable
//    catalogue reward.
//  - `expiry_days` is the validity WINDOW, centred on the birthday: 3 days
//    means issue the day before and redeem through the day after. The cron
//    sends on the window's opening day at the configured hour (MY time).

function getNowMY() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (8 * 3600000));
}

function generateVoucherCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "BDAY-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** A day shift that keeps the MY wall-clock fields intact. */
function addDaysMY(y, m, d, n) {
  const dt = new Date(y, m, d + n);
  return {
    year: dt.getFullYear(),
    month: dt.getMonth(),
    day: dt.getDate(),
  };
}

/**
 * The reward that backs the birthday voucher. One per merchant, scope "system"
 * so the redeemable catalogue never lists it. Safe to call repeatedly.
 */
function ensureBirthdayReward(config) {
  const merchantId = config.getString("merchant");
  if (!merchantId) throw new Error("birthday config has no merchant");

  const title = config.getString("title") || "Birthday Reward";
  const description = config.getString("description") || "";
  const linkedId = config.getString("reward");

  if (linkedId) {
    try {
      const linked = $app.findRecordById("rewards", linkedId);
      let changed = false;
      if (linked.getString("name") !== title) { linked.set("name", title); changed = true; }
      if (linked.getString("description") !== description) { linked.set("description", description); changed = true; }
      if (!linked.getBool("is_active")) { linked.set("is_active", true); changed = true; }
      if (changed) $app.save(linked);
      return linked;
    } catch (err) {
      // Link points at a deleted reward; fall through and recreate it.
    }
  }

  const col = $app.findCollectionByNameOrId("rewards");
  const reward = new Record(col);
  reward.set("merchant", merchantId);
  reward.set("name", title);
  reward.set("description", description);
  reward.set("points_cost", 1);
  reward.set("stock", 1000000);
  reward.set("is_active", true);
  reward.set("reward_scope", "system");
  reward.set("type", "free_item");
  reward.set("discount_type", "none");
  reward.set("applicable_items_text", config.getString("gift_item_name") || config.getString("reward_value") || title);
  $app.save(reward);

  config.set("reward", reward.id);
  $app.save(config);
  return reward;
}

function sendBirthdayPush(customerId, merchantName, payload, tag) {
  try {
    const pushHelper = require(`${__hooks}/push_notify.js`);
    pushHelper.sendPushToUser(customerId, {
      title: `Happy Birthday from ${merchantName}! 🎂🎉`,
      body: payload,
      url: "/(customer)/vouchers",
      tag: tag,
    });
  } catch (pushErr) {
    console.log("[BIRTHDAY PUSH NOTICE]", pushErr.message || pushErr);
  }
}

function processBirthdayRewards(options) {
  options = options || {};
  const isForce = !!options.force;
  const targetMerchantId = options.merchantId || null;

  const myDate = getNowMY();
  const currentHour = myDate.getHours();
  const todayY = myDate.getFullYear();
  const todayM = myDate.getMonth();
  const todayD = myDate.getDate();

  let filter = "is_active = true";
  if (targetMerchantId) {
    filter += ` && merchant = "${targetMerchantId}"`;
  }

  let configs = [];
  try {
    // Newest first; only the latest config per merchant is honoured so a stale
    // duplicate cannot issue a second, different gift for the same year.
    configs = $app.findRecordsByFilter("birthday_rewards", filter, "-created", 500, 0);
  } catch (err) {
    console.log("[BIRTHDAY RUNNER] Error fetching birthday rewards:", err.message || err);
    return { error: err.message || err };
  }

  const seenMerchants = {};
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const merchantId = config.getString("merchant");
    if (!merchantId) continue;
    if (seenMerchants[merchantId]) continue;
    seenMerchants[merchantId] = true;

    const sendTime = config.getString("send_time") || "09:00";
    const targetHour = parseInt(sendTime.split(":")[0], 10);
    if (!isForce && currentHour < (isNaN(targetHour) ? 9 : targetHour)) {
      continue;
    }

    let merchantName = "Your favourite store";
    try {
      merchantName = $app.findRecordById("merchants", merchantId).getString("name") || merchantName;
    } catch (mErr) {
      continue;
    }

    let reward = null;
    try {
      reward = ensureBirthdayReward(config);
    } catch (rErr) {
      console.log("[BIRTHDAY RUNNER] Could not prepare reward:", rErr.message || rErr);
      failed++;
      continue;
    }

    // Window: N days centred on the birthday. N=3 issues the day before.
    const windowDays = Math.max(1, config.getInt("expiry_days") || 3);
    const daysBefore = Math.floor((windowDays - 1) / 2);
    const daysAfter = windowDays - 1 - daysBefore;
    const bday = addDaysMY(todayY, todayM, todayD, daysBefore);
    const birthdayMD = `-${pad2(bday.month + 1)}-${pad2(bday.day)}`;
    const birthdayYear = bday.year;

    // End of the last valid day, in MY time (UTC+8) -> 15:59:59Z.
    const expiryIso = new Date(Date.UTC(bday.year, bday.month, bday.day + daysAfter, 15, 59, 59)).toISOString();

    let customers = [];
    try {
      customers = $app.findRecordsByFilter(
        "users",
        `birthday ~ "${birthdayMD}" && verified = true`,
        "created",
        500,
        0
      );
    } catch (cErr) {
      console.log(`[BIRTHDAY RUNNER] Error querying birthday ~ "${birthdayMD}":`, cErr.message || cErr);
      continue;
    }

    const title = config.getString("title") || "Birthday Reward";
    const description = config.getString("description") || `Birthday reward from ${merchantName}`;
    const giftName = config.getString("gift_item_name") || config.getString("reward_value") || title;
    const rewardType = config.getString("reward_type") || "voucher_code";

    for (let c = 0; c < customers.length; c++) {
      const customer = customers[c];
      const customerId = customer.id;
      const bdayRaw = (customer.getString("birthday") || "").substring(0, 10);
      const email = customer.getString("email") || "";

      if (!customer.getBool("verified")) { skipped++; continue; }
      if (!bdayRaw.endsWith(birthdayMD)) { skipped++; continue; }
      // Shadow/quick accounts never completed signup, so their placeholder
      // birthday must never earn a reward.
      if (email.startsWith("shadow_") || email.startsWith("quick_") || email.endsWith("@risev.app")) {
        skipped++;
        continue;
      }

      let existing = [];
      try {
        existing = $app.findRecordsByFilter(
          "birthday_logs",
          `customer = "${customerId}" && merchant = "${merchantId}" && year = ${birthdayYear}`,
          "created",
          1,
          0
        );
      } catch (lErr) {}
      if (existing && existing.length > 0) { skipped++; continue; }

      let cards = [];
      try {
        cards = $app.findRecordsByFilter(
          "loyalty_cards",
          `customer = "${customerId}" && merchant = "${merchantId}"`,
          "-created",
          1,
          0
        );
      } catch (cardErr) {}
      if (!cards || cards.length === 0) { skipped++; continue; }
      const card = cards[0];

      let voucherId = null;
      let voucherCode = null;

      try {
        if (rewardType === "stamps") {
          const numStamps = parseInt(config.getString("reward_value"), 10) || 1;
          const currentStamps = parseInt(card.get("stamps_collected") || 0, 10);
          card.set("stamps_collected", currentStamps + numStamps);
          card.set("last_activity", new Date().toISOString().replace("T", " ").substring(0, 19));
          $app.save(card);

          const txnCol = $app.findCollectionByNameOrId("transactions");
          const txn = new Record(txnCol);
          txn.set("id", $security.randomString(15).toLowerCase());
          txn.set("type", "earn");
          txn.set("stamps", numStamps);
          txn.set("bill_amount", 0);
          txn.set("customer", customerId);
          txn.set("merchant", merchantId);
          txn.set("loyalty_card", card.id);
          txn.set("metadata", JSON.stringify({
            source: "birthday_reward",
            reason: "Birthday bonus stamps",
            merchant_name: merchantName
          }));
          $app.save(txn);
        } else {
          voucherCode = generateVoucherCode();
          const voucherCol = $app.findCollectionByNameOrId("vouchers");
          const voucher = new Record(voucherCol);
          voucher.set("id", $security.randomString(15).toLowerCase());
          voucher.set("customer", customerId);
          voucher.set("code", voucherCode);
          voucher.set("status", "active");
          voucher.set("expires_at", expiryIso);
          voucher.set("reward", reward.id);
          voucher.set("metadata", JSON.stringify({
            merchant_id: merchantId,
            merchant_name: merchantName,
            reward_id: reward.id,
            title: title,
            description: description,
            reward_type: "voucher_code",
            discount_type: "none",
            discount_value: "",
            applicable_items_text: giftName,
            discount_scope: "all",
            source: "birthday_reward",
            birthday_year: birthdayYear,
            valid_until: expiryIso
          }));
          $app.save(voucher);
          voucherId = voucher.id;
        }

        const logCol = $app.findCollectionByNameOrId("birthday_logs");
        const log = new Record(logCol);
        log.set("id", $security.randomString(15).toLowerCase());
        log.set("customer", customerId);
        log.set("merchant", merchantId);
        log.set("reward", config.id);
        if (voucherId) log.set("voucher", voucherId);
        log.set("year", birthdayYear);
        log.set("status", "sent");
        $app.save(log);

        const pushBody = rewardType === "stamps"
          ? `We gifted you ${parseInt(config.getString("reward_value"), 10) || 1} bonus stamps to celebrate your special day!`
          : `${title} is waiting in your wallet${voucherCode ? ` (code ${voucherCode})` : ""}. Valid until ${expiryIso.substring(0, 10)}.`;
        sendBirthdayPush(customerId, merchantName, pushBody, `birthday-${merchantId}-${birthdayYear}`);

        sent++;
      } catch (procErr) {
        console.log(`[BIRTHDAY PROCESS ERROR] Customer ${customerId}, Merchant ${merchantId}:`, procErr.message || procErr);
        failed++;
      }
    }
  }

  return {
    date: `${todayY}-${pad2(todayM + 1)}-${pad2(todayD)}`,
    sent: sent,
    failed: failed,
    skipped: skipped,
  };
}

module.exports = {
  getNowMY,
  generateVoucherCode,
  ensureBirthdayReward,
  processBirthdayRewards,
};
