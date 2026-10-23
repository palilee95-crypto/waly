// pb_hooks/rewards_guard.pb.js
//
// `rewards.deleteRule` / `updateRule` let the owning merchant write the table
// freely, which is wrong for the rows that are not merchant content:
//   * `reward_scope = 'system'` — the internal "Points Cash Voucher" backing
//     record (points -> cash). Editing it on prod silently dropped
//     `type: cash_credit` and `discount_type: fixed_amount`, and deleting it
//     orphans every `PC-` voucher already issued.
//   * the stamp card prize — `loyalty_programs.linked_reward`. Deleting it means
//     completions stop issuing a voucher with no error anywhere.
//   * any reward customers still hold an active voucher for.
//
// These are REQUEST hooks on purpose: they only cover API writes (the merchant
// app), while the server-side `$app.save` calls in stamp_complete / points_cash
// must keep working.
//
// This guard replaces the rewards block that used to live at the bottom of
// sync_program_reward.pb.js. That file already registered four hooks and a second
// `onRecordDelete` in one file does not fire reliably in this JSVM, so the guard
// could not be trusted there.

onRecordUpdateRequest((e) => {
  const authRecord = e.auth;
  if (!authRecord) return e.next();

  const isSuperuser =
    authRecord.isSuperuser === true ||
    (authRecord.collection && authRecord.collection().name === "_superusers");

  if (isSuperuser) return e.next();

  const original = e.record.original();
  const prevScope = original ? (original.getString ? original.getString("reward_scope") : "") : "";
  const nextScope = e.record.getString ? e.record.getString("reward_scope") : "";

  if (prevScope === "system") {
    throw new ForbiddenError(
      "This record is managed by Risev and cannot be edited. It backs the points-to-cash vouchers."
    );
  }

  if (nextScope === "system") {
    throw new ForbiddenError("A reward cannot be marked as a system record.");
  }

  return e.next();
}, "rewards");

onRecordDeleteRequest((e) => {
  const reward = e.record;
  const rewardId = reward.id;
  const scope = reward.getString ? reward.getString("reward_scope") : "";

  const authRecord = e.auth;
  const isSuperuser =
    !!authRecord && (authRecord.isSuperuser === true ||
      (authRecord.collection && authRecord.collection().name === "_superusers"));

  if (scope === "system") {
    if (isSuperuser) return e.next();
    throw new ForbiddenError(
      "This record is managed by Risev and cannot be deleted. It backs the points-to-cash vouchers."
    );
  }

  // The stamp card prize: unlink it in Card Design first.
  let linked = [];
  try {
    linked = $app.findRecordsByFilter(
      "loyalty_programs",
      "linked_reward = {:rid}",
      "-created",
      1,
      0,
      { rid: rewardId }
    );
  } catch (err) {
    console.log("[REWARDS GUARD] program lookup failed:", err && err.message ? err.message : err);
    throw new ApiError(500, "Could not verify this reward is not in use. Please try again.");
  }
  if (linked && linked.length > 0) {
    throw new BadRequestError(
      "This reward is your stamp card prize. Choose a different prize in Card Design before deleting it."
    );
  }

  // Customers still holding it.
  let activeVouchers = [];
  try {
    activeVouchers = $app.findRecordsByFilter(
      "vouchers",
      'reward = {:rid} && status = "active"',
      "-created",
      1,
      0,
      { rid: rewardId }
    );
  } catch (err) {
    console.log("[REWARDS GUARD] voucher lookup failed:", err && err.message ? err.message : err);
    throw new ApiError(500, "Could not verify this reward is not in use. Please try again.");
  }
  if (activeVouchers && activeVouchers.length > 0) {
    throw new BadRequestError(
      "Customers still hold active vouchers for this reward. Turn it off instead so it stops being offered, and delete it once those vouchers are used or expired."
    );
  }

  let pendingRedemptions = [];
  try {
    pendingRedemptions = $app.findRecordsByFilter(
      "redemptions",
      'reward = {:rid} && status = "pending"',
      "-created",
      1,
      0,
      { rid: rewardId }
    );
  } catch (err) {
    console.log("[REWARDS GUARD] redemption lookup failed:", err && err.message ? err.message : err);
  }
  if (pendingRedemptions && pendingRedemptions.length > 0) {
    throw new BadRequestError(
      "This reward has redemptions waiting to be served at the counter. Settle them first."
    );
  }

  // An active campaign pinning it would be left dangling.
  let activeCampaigns = [];
  try {
    activeCampaigns = $app.findRecordsByFilter(
      "campaigns",
      "linked_reward = {:rid} && is_active = true",
      "-created",
      1,
      0,
      { rid: rewardId }
    );
  } catch (err) {}
  if (activeCampaigns && activeCampaigns.length > 0) {
    throw new BadRequestError(
      "An active campaign is using this reward. End the campaign or pick another reward first."
    );
  }

  if (isSuperuser) return e.next();

  // Nothing depends on it: unlink it from finished campaigns so no dangling ids
  // are left behind by the delete itself.
  try {
    const campaigns = $app.findRecordsByFilter(
      "campaigns",
      "linked_reward = {:rid}",
      "-created",
      100,
      0,
      { rid: rewardId }
    );
    for (let i = 0; i < campaigns.length; i++) {
      campaigns[i].set("linked_reward", null);
      $app.save(campaigns[i]);
    }
  } catch (err) {
    console.log("[REWARDS GUARD] campaign unlink failed:", err && err.message ? err.message : err);
  }

  return e.next();
}, "rewards");
