// Point earning for `earn` transactions.
//
// Phase 1 (onRecordCreate) is pure: it computes the points and writes them on the
// pending record. No other collection is touched.
// Phase 2 (onRecordAfterCreateSuccess) applies the side effects — card balance,
// bonus stamps, campaign counters, derived users.total_points — only once the
// transaction is committed, so a rejection in velocity_check.pb.js cannot leave
// points on the account.
//
// All maths lives in points_engine.js; this file only orchestrates.

onRecordCreate((e) => {
  if (e.record.get("type") !== "earn") return e.next();

  try {
    const engine = require(`${__hooks}/points_engine.js`);
    const computed = engine.computeEarning(e.record);
    if (computed.skip) return e.next();

    e.record.set("points", computed.finalPoints);

    if (computed.bonusStamps > 0) {
      const baseStamps = Number(e.record.get("stamps")) || 0;
      e.record.set("stamps", baseStamps + computed.bonusStamps);
    }

    // Keep the calculation on the record so the receipt and support can explain it.
    let existing = {};
    try {
      const raw = (e.record.getString ? e.record.getString("metadata") : "") || "";
      if (raw && raw.trim().charAt(0) === "{") existing = JSON.parse(raw);
    } catch (err) {}

    const bill = Number(e.record.get("bill_amount")) || 0;
    e.record.set(
      "metadata",
      JSON.stringify(
        Object.assign({}, existing, {
          bill_amount: bill,
          spend_per_point: computed.spendPerPoint,
          base_points: computed.basePoints,
          campaign_multiplier: computed.campaignMultiplier,
          flat_bonus: computed.flatBonus,
          bonus_stamps: computed.bonusStamps,
          streak_multiplier: computed.streakMultiplier,
          calculated_at: new Date().toISOString(),
          points_calc: computed,
        })
      )
    );
  } catch (err) {
    console.log("[MULTIPLIER HOOK] Compute failed:", err && err.message ? err.message : err);
  }

  return e.next();
}, "transactions");

onRecordAfterCreateSuccess((e) => {
  if (e.record.get("type") !== "earn") return e.next();
  try {
    const engine = require(`${__hooks}/points_engine.js`);
    engine.applyEarning(e.record);
  } catch (err) {
    console.log("[MULTIPLIER HOOK] Apply failed:", err && err.message ? err.message : err);
  }
  return e.next();
}, "transactions");
