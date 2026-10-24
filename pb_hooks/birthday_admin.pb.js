/// <reference path="../pb_data/types.d.ts" />
// Keeps the birthday config's catalogue reward in sync as soon as the merchant
// saves. The voucher issued by the cron links to this record, so the wallet
// shows the real birthday gift instead of whatever reward happened to be
// created last. reward_scope = "system" keeps it out of the redeemable list.
//
// Note: Goja does not expose file-scope functions inside hook callbacks, so the
// lookup is inlined in each handler.

onRecordAfterCreateSuccess((e) => {
  try {
    const helper = require(`${__hooks}/birthday_helper.js`);
    helper.ensureBirthdayReward(e.record);
  } catch (err) {
    // Never block the merchant's save because the backing reward failed.
    console.log("[BIRTHDAY ADMIN] Could not prepare reward:", err.message || err);
  }
  return e.next();
}, "birthday_rewards");

onRecordAfterUpdateSuccess((e) => {
  try {
    const helper = require(`${__hooks}/birthday_helper.js`);
    helper.ensureBirthdayReward(e.record);
  } catch (err) {
    console.log("[BIRTHDAY ADMIN] Could not prepare reward:", err.message || err);
  }
  return e.next();
}, "birthday_rewards");
