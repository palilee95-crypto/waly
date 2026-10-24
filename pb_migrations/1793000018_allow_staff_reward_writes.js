/// <reference path="../pb_data/types.d.ts" />
// Rewards were owner-only at the collection level, so the `can_manage_rewards`
// staff permission could never work — granting it only unlocked the screen.
//
// Allow any staff of the merchant through the API rules, then let
// rewards_staff_guard.pb.js enforce the granular permission (owner always
// passes). Cross-merchant writes stay impossible: the staff clause requires
// @request.auth.merchant_id = merchant.id.
migrate((app) => {
  try {
    const rewards = app.findCollectionByNameOrId("rewards");
    const rule = "merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != '')";
    rewards.createRule = rule;
    rewards.updateRule = rule;
    rewards.deleteRule = rule;
    app.save(rewards);
    console.log("[MIGRATION 1793000018] Rewards writes now reach the staff permission guard");
  } catch (err) {
    console.log("[MIGRATION 1793000018 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const rewards = app.findCollectionByNameOrId("rewards");
    rewards.createRule = "merchant.owner = @request.auth.id";
    rewards.updateRule = "merchant.owner = @request.auth.id";
    rewards.deleteRule = "merchant.owner = @request.auth.id";
    app.save(rewards);
  } catch (err) {
    console.log("[MIGRATION 1793000018 DOWN ERROR]", err.message || err);
  }
});
