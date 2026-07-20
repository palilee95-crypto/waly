/// <reference path="../pb_data/types.d.ts" />
// Daily birthday reward automation.
// Triggered by external cron at configured time (default 09:00).
// Endpoint: GET /api/risev/cron/birthdays?secret=CRON_SECRET

const CRON_SECRET = $os.getenv("BIRTHDAY_CRON_SECRET") || $os.getenv("CRON_SECRET") || "";
const DEFAULT_SEND_TIME = "09:00";

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function timeStr() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function generateVoucherCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "BDAY-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getAbGroup(customerId) {
  // Deterministic 50/50 split based on customer id hash
  let hash = 0;
  for (let i = 0; i < customerId.length; i++) {
    hash = (hash << 5) - hash + customerId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2 === 0 ? "A" : "B";
}

routerAdd("GET", "/api/risev/cron/birthdays", (e) => {
  const { sendTextMessage } = require(`${__hooks}/whatsapp_helper.js`);

  const secret = e.requestInfo().query.secret || "";
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return e.json(401, { message: "Unauthorized" });
  }

  const now = new Date();
  const currentTime = timeStr();
  const currentDate = todayStr();
  const currentYear = now.getFullYear();

  // Find active birthday rewards whose send_time matches current hour:minute
  const rewards = $app.findRecordsByFilter(
    "birthday_rewards",
    `is_active = true && send_time = "${currentTime}"`,
    "created",
    0,
    0
  );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reward of rewards) {
    const merchant = reward.get("merchant");
    const merchantId = merchant;
    const merchantRecord = $app.findRecordById("merchants", merchantId);
    const merchantName = merchantRecord.getString("name") || "Your favourite store";
    const instanceName = `merchant-${merchantId}`;

    // Find customers whose birthday is today and have a card/stamp relationship with this merchant
    const customers = $app.findRecordsByFilter(
      "users",
      `birthday ~ "${currentDate}"`,
      "created",
      0,
      0
    );

    for (const customer of customers) {
      const customerId = customer.id;
      const customerPhone = customer.getString("phone");
      if (!customerPhone) {
        skipped++;
        continue;
      }

      // Check if already sent this year by this merchant
      const existingLogs = $app.findRecordsByFilter(
        "birthday_logs",
        `customer = "${customerId}" && merchant = "${merchantId}" && year = ${currentYear}`,
        "created",
        1,
        0
      );
      if (existingLogs.length > 0) {
        skipped++;
        continue;
      }

      // Verify customer has relationship with merchant (loyalty card)
      const cards = $app.findRecordsByFilter(
        "loyalty_cards",
        `customer = "${customerId}" && merchant = "${merchantId}"`,
        "created",
        1,
        0
      );
      if (cards.length === 0) {
        skipped++;
        continue;
      }

      // Create voucher if reward_type is voucher_code
      let voucherId = null;
      let voucherCode = generateVoucherCode();
      const rewardType = reward.getString("reward_type");
      const expiryDays = reward.getInt("expiry_days") || 7;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);
      const expiryIso = expiryDate.toISOString();

      if (rewardType === "voucher_code" || rewardType === "free_item" || rewardType === "discount_percent") {
        const voucher = new Record($app.findCollectionByNameOrId("vouchers"), {
          customer: customerId,
          merchant: merchantId,
          code: voucherCode,
          type: rewardType === "free_item" ? "free_item" : (rewardType === "discount_percent" ? "discount_percent" : "voucher_code"),
          value: reward.get("reward_value") || 0,
          title: reward.getString("title") || "Birthday Reward",
          description: reward.getString("description") || `Birthday reward from ${merchantName}`,
          status: "active",
          valid_until: expiryIso,
        });
        $app.save(voucher);
        voucherId = voucher.id;
      }

      // A/B test message template
      const abGroup = getAbGroup(customerId);
      let template = reward.getString("message_template") || "Happy Birthday {{name}}! Here's your gift from {{merchant}}: {{title}}. Code: {{code}}. Valid until {{expiry}}.";
      if (abGroup === "B" && reward.getString("message_template_b")) {
        template = reward.getString("message_template_b");
      }

      const message = template
        .replace(/\{\{name\}\}/g, customer.getString("name") || "there")
        .replace(/\{\{merchant\}\}/g, merchantName)
        .replace(/\{\{title\}\}/g, reward.getString("title") || "a birthday reward")
        .replace(/\{\{code\}\}/g, voucherCode)
        .replace(/\{\{expiry\}\}/g, expiryDate.toLocaleDateString("en-MY"));

      // Send WhatsApp
      const log = new Record($app.findCollectionByNameOrId("birthday_logs"), {
        customer: customerId,
        merchant: merchantId,
        reward: reward.id,
        voucher: voucherId,
        year: currentYear,
        status: "pending",
        ab_group: abGroup,
      });

      try {
        sendTextMessage(instanceName, customerPhone, message);
        log.set("status", "sent");
        sent++;
      } catch (err) {
        log.set("status", "failed");
        log.set("error_message", err.message || String(err));
        failed++;
      }

      $app.save(log);
    }
  }

  return e.json(200, {
    success: true,
    date: currentDate,
    time: currentTime,
    sent,
    failed,
    skipped,
  });
});