/// <reference path="../pb_data/types.d.ts" />
// Daily birthday reward automation (In-App Vouchers / Bonus Stamps + Web Push).
// No WhatsApp integration — rewards are issued directly to customer wallet / stamp card.

// 1. Hourly cron runner — checks and triggers birthday rewards when send_time hour arrives
cronAdd("daily_birthday_rewards", "0 * * * *", () => {
  try {
    const { processBirthdayRewards } = require(`${__hooks}/birthday_helper.js`);
    const result = processBirthdayRewards();
    if (result && result.sent > 0) {
      console.log(`[BIRTHDAY CRON] Processed birthday rewards: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed.`);
    }
  } catch (err) {
    console.log("[BIRTHDAY CRON ERROR]", err.message || err);
  }
});

// 2. Endpoint for manual trigger or testing (protected by CRON_SECRET if set)
routerAdd("GET", "/api/risev/cron/birthdays", (e) => {
  try {
    const cronSecret = $os.getenv("BIRTHDAY_CRON_SECRET") || $os.getenv("CRON_SECRET") || "";
    const secret = e.requestInfo().query.secret || "";
    if (cronSecret && secret !== cronSecret) {
      return e.json(401, { message: "Unauthorized" });
    }

    const force = e.requestInfo().query.force === "true";
    const { processBirthdayRewards } = require(`${__hooks}/birthday_helper.js`);
    const result = processBirthdayRewards({ force: force });

    return e.json(200, Object.assign({ success: true }, result));
  } catch (err) {
    console.log("[BIRTHDAY TRIGGER ERROR]:", err.message || err);
    return e.json(500, { success: false, error: err.message || err });
  }
});

// 3. Authenticated merchant endpoint to manually test birthday trigger for their store
routerAdd("POST", "/api/risev/merchant/birthdays/test", (e) => {
  const authRecord = e.auth || e.requestInfo().auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized" });
  }

  let merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    const merchants = $app.findRecordsByFilter("merchants", `owner = "${authRecord.id}"`, "created", 1, 0);
    if (merchants.length > 0) merchantId = merchants[0].id;
  }

  if (!merchantId) {
    return e.json(400, { message: "No merchant profile associated with logged in account." });
  }

  try {
    const { processBirthdayRewards } = require(`${__hooks}/birthday_helper.js`);
    const result = processBirthdayRewards({ force: true, merchantId: merchantId });
    return e.json(200, Object.assign({
      success: true,
      message: "Birthday trigger executed for store"
    }, result));
  } catch (err) {
    console.log("[BIRTHDAY TEST TRIGGER ERROR]:", err.message || err);
    return e.json(500, { success: false, error: err.message || err });
  }
}, $apis.requireAuth("users"));