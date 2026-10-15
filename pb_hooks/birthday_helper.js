/// <reference path="../pb_data/types.d.ts" />
// pb_hooks/birthday_helper.js
// Daily birthday reward automation logic (In-App Vouchers / Bonus Stamps + Web Push).

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

function processBirthdayRewards(options) {
  options = options || {};
  const isForce = !!options.force;
  const targetMerchantId = options.merchantId || null;

  const myDate = getNowMY();
  const currentYear = myDate.getFullYear();
  const m = String(myDate.getMonth() + 1).padStart(2, "0");
  const d = String(myDate.getDate()).padStart(2, "0");
  const monthDay = `-${m}-${d}`;
  const currentHour = myDate.getHours();
  const currentMinute = myDate.getMinutes();
  const currentTime = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  // Find active birthday rewards
  let rewardFilter = "is_active = true";
  if (targetMerchantId) {
    rewardFilter += ` && merchant = "${targetMerchantId}"`;
  }

  let rewards = [];
  try {
    rewards = $app.findRecordsByFilter(
      "birthday_rewards",
      rewardFilter,
      "created",
      500,
      0
    );
  } catch (err) {
    console.log("[BIRTHDAY RUNNER] Error fetching birthday rewards:", err.message || err);
    return { error: err.message || err };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < rewards.length; i++) {
    const reward = rewards[i];
    const merchantId = reward.getString("merchant");
    if (!merchantId) continue;

    // Check scheduled send_time hour unless force is enabled
    const sendTime = reward.getString("send_time") || "09:00";
    if (!isForce) {
      const parts = sendTime.split(":");
      const targetHour = parseInt(parts[0], 10) || 9;
      if (currentHour < targetHour) {
        continue;
      }
    }

    let merchantRecord = null;
    let merchantName = "Your favourite store";
    try {
      merchantRecord = $app.findRecordById("merchants", merchantId);
      merchantName = merchantRecord.getString("name") || merchantName;
    } catch (mErr) {
      continue;
    }

    // Find customers whose birthday matches month and day (-MM-DD) and are verified
    let customers = [];
    try {
      customers = $app.findRecordsByFilter(
        "users",
        `birthday ~ "${monthDay}" && verified = true`,
        "created",
        500,
        0
      );
    } catch (cErr) {
      console.log(`[BIRTHDAY RUNNER] Error querying users with birthday ~ "${monthDay}":`, cErr.message || cErr);
      continue;
    }

    for (let c = 0; c < customers.length; c++) {
      const customer = customers[c];
      const customerId = customer.id;
      const bdayRaw = customer.getString("birthday") || "";
      const email = customer.getString("email") || "";

      // Strict verification gate: Only verified accounts are eligible for birthday rewards
      if (!customer.getBool("verified")) {
        skipped++;
        continue;
      }

      // Strict validation on month and day
      const cleanBday = bdayRaw.substring(0, 10);
      if (!cleanBday.endsWith(monthDay)) {
        skipped++;
        continue;
      }

      // Exclude placeholder 2000-01-01 sentinels and shadow accounts
      const isShadow = email.startsWith("shadow_") || email.startsWith("quick_") || email.endsWith("@risev.app");
      if (cleanBday === "2000-01-01" || isShadow) {
        skipped++;
        continue;
      }

      // Check if already rewarded this calendar year for this merchant
      let existingLogs = [];
      try {
        existingLogs = $app.findRecordsByFilter(
          "birthday_logs",
          `customer = "${customerId}" && merchant = "${merchantId}" && year = ${currentYear}`,
          "created",
          1,
          0
        );
      } catch (lErr) {}

      if (existingLogs && existingLogs.length > 0) {
        skipped++;
        continue;
      }

      // Verify customer has loyalty card relationship with this merchant
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

      if (!cards || cards.length === 0) {
        skipped++;
        continue;
      }
      const card = cards[0];

      const rewardType = reward.getString("reward_type") || "voucher_code";
      const rewardValue = reward.getString("reward_value") || "";
      const title = reward.getString("title") || "Birthday Reward";
      const description = reward.getString("description") || `Birthday reward from ${merchantName}`;
      const expiryDays = reward.getInt("expiry_days") || 7;
      const expiryDate = new Date(myDate.getTime() + expiryDays * 86400000);
      const expiryIso = expiryDate.toISOString();

      let voucherId = null;
      let voucherCode = null;

      try {
        if (rewardType === "stamps") {
          // --- BONUS STAMPS REWARD ---
          const numStamps = parseInt(rewardValue, 10) || 1;
          const currentStamps = parseInt(card.get("stamps_collected") || 0, 10);
          const totalStamps = currentStamps + numStamps;
          card.set("stamps_collected", totalStamps);
          card.set("last_activity", new Date().toISOString().replace("T", " ").substring(0, 19));
          $app.save(card);

          // Record earn transaction
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
          // --- DIGITAL VOUCHER CODE REWARD ---
          voucherCode = generateVoucherCode();
          const voucherCol = $app.findCollectionByNameOrId("vouchers");
          const voucher = new Record(voucherCol);
          voucher.set("id", $security.randomString(15).toLowerCase());
          voucher.set("customer", customerId);
          voucher.set("code", voucherCode);
          voucher.set("status", "active");
          voucher.set("expires_at", expiryIso);

          // Link merchant catalog reward if one exists, or provision a backing reward record
          let rewardId = null;
          try {
            const catalogRewards = $app.findRecordsByFilter(
              "rewards",
              `merchant = "${merchantId}"`,
              "-created",
              1,
              0
            );
            if (catalogRewards.length > 0) {
              rewardId = catalogRewards[0].id;
            } else {
              const rewardsCol = $app.findCollectionByNameOrId("rewards");
              const r = new Record(rewardsCol);
              r.set("merchant", merchantId);
              r.set("name", title || "Birthday Reward");
              r.set("description", description || `Birthday reward from ${merchantName}`);
              r.set("points_cost", 1);
              r.set("stock", 1000000);
              r.set("is_active", true);
              r.set("type", rewardType === "discount_percent" ? "discount" : "free_item");
              r.set("discount_value", parseFloat(rewardValue) || 0);
              $app.save(r);
              rewardId = r.id;
            }
          } catch (rErr) {
            console.log("[BIRTHDAY RUNNER] Reward link error:", rErr.message || rErr);
          }

          if (rewardId) {
            voucher.set("reward", rewardId);
          }

          voucher.set("metadata", JSON.stringify({
            merchant_id: merchantId,
            merchant_name: merchantName,
            title: title,
            description: description,
            reward_type: rewardType,
            reward_value: rewardValue,
            source: "birthday_reward"
          }));
          $app.save(voucher);
          voucherId = voucher.id;
        }

        // Create birthday log entry
        const logCol = $app.findCollectionByNameOrId("birthday_logs");
        const log = new Record(logCol);
        log.set("id", $security.randomString(15).toLowerCase());
        log.set("customer", customerId);
        log.set("merchant", merchantId);
        log.set("reward", reward.id);
        if (voucherId) {
          log.set("voucher", voucherId);
        }
        log.set("year", currentYear);
        log.set("status", "sent");
        $app.save(log);

        // Send Push Notification
        try {
          const pushHelper = require(`${__hooks}/push_notify.js`);
          const pushTitle = `Happy Birthday from ${merchantName}! 🎂🎉`;
          let pushBody = "";
          if (rewardType === "stamps") {
            const numStamps = parseInt(rewardValue, 10) || 1;
            pushBody = `We gifted you ${numStamps} bonus stamp${numStamps > 1 ? "s" : ""} to celebrate your special day!`;
          } else {
            pushBody = `Special treat for you: ${title}. Tap to view your voucher code (${voucherCode})!`;
          }
          pushHelper.sendPushToUser(customerId, {
            title: pushTitle,
            body: pushBody,
            url: rewardType === "stamps" ? "/(customer)" : "/(customer)/vouchers",
            tag: `birthday-${merchantId}-${currentYear}`
          });
        } catch (pushErr) {
          console.log("[BIRTHDAY PUSH NOTICE]", pushErr.message || pushErr);
        }

        sent++;
      } catch (procErr) {
        console.log(`[BIRTHDAY PROCESS ERROR] Customer ${customerId}, Merchant ${merchantId}:`, procErr.message || procErr);
        failed++;
      }
    }
  }

  return {
    date: `${myDate.getFullYear()}-${m}-${d}`,
    time: currentTime,
    sent: sent,
    failed: failed,
    skipped: skipped
  };
}

module.exports = {
  getNowMY,
  generateVoucherCode,
  processBirthdayRewards,
};
