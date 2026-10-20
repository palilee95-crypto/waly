// Point earning, shared by the create hook (pure computation) and the
// after-create hook (side effects), plus the ledger helper used by every debit.
//
// Why two phases: `onRecordCreate` runs BEFORE other transaction hooks such as
// velocity_check.pb.js. Crediting the card there left points on an account whose
// sale was then rejected. Computation mutates only the pending record; crediting
// happens in `onRecordCreateSuccess`, i.e. after the transaction is committed.
//
// Metrics are read-only here — nothing in computeEarning() writes to the database.

const DEFAULT_SPEND_PER_POINT = 1.0;

function resolveCard(txn) {
  const customerId = txn.get("customer");
  const merchantId = txn.get("merchant");
  const cardId = txn.get("loyalty_card");
  if (cardId) return $app.findRecordById("loyalty_cards", cardId);
  return $app.findFirstRecordByFilter(
    "loyalty_cards",
    "customer = {:cid} && merchant = {:mid}",
    { cid: customerId, mid: merchantId }
  );
}

function resolveProgram(card) {
  const programId = card.get("program");
  if (!programId) return null;
  return $app.findRecordById("loyalty_programs", programId);
}

function activeCampaign(merchantId, type, now) {
  const list = $app.findRecordsByFilter(
    "campaigns",
    "merchant = {:mid} && is_active = true && start_date <= {:now} && end_date >= {:now} && type = {:type}",
    "-created",
    1,
    0,
    { mid: merchantId, now: now, type: type }
  );
  if (!list.length) return null;
  const camp = list[0];
  const maxRed = Number(camp.get("max_redemptions")) || 0;
  const curRed = Number(camp.get("current_redemptions")) || 0;
  if (maxRed > 0 && curRed >= maxRed) return null; // exhausted
  return camp;
}

function streakMultiplier(customerId) {
  try {
    const streak = $app.findFirstRecordByFilter("streaks", "user = {:uid}", { uid: customerId });
    const current = Number(streak.get("current_streak")) || 0;
    if (current >= 100) return 1.5;
    if (current >= 30) return 1.25;
    if (current >= 7) return 1.1;
  } catch (err) {
    // no streak record yet
  }
  return 1.0;
}

/**
 * Pure calculation. Returns the points to write on the transaction plus the
 * campaign ids that must be counted once the transaction commits.
 */
function computeEarning(txn) {
  const out = {
    skip: false,
    reason: "",
    spendPerPoint: DEFAULT_SPEND_PER_POINT,
    basePoints: 0,
    finalPoints: 0,
    campaignMultiplier: 1,
    flatBonus: 0,
    bonusStamps: 0,
    streakMultiplier: 1,
    campaignIds: { double_points: "", flat_bonus: "", bonus_stamps: "" },
  };

  if (txn.get("type") !== "earn") {
    out.skip = true;
    out.reason = "not_earn";
    return out;
  }

  const customerId = txn.get("customer");
  const merchantId = txn.get("merchant");
  const now = new Date().toISOString();

  let card = null;
  try {
    card = resolveCard(txn);
  } catch (err) {
    out.skip = true;
    out.reason = "no_card";
    return out;
  }
  if (!card) {
    out.skip = true;
    out.reason = "no_card";
    return out;
  }

  // A program lookup failure must SKIP earning. The old code swallowed it inside a
  // try/catch and fell through to the default rate, paying points the merchant never
  // configured.
  let program = null;
  try {
    program = resolveProgram(card);
  } catch (err) {
    out.skip = true;
    out.reason = "no_program";
    return out;
  }
  if (!program) {
    out.skip = true;
    out.reason = "no_program";
    return out;
  }

  if (program.get("enable_points") === false) {
    out.skip = true;
    out.reason = "points_disabled";
    return out;
  }

  const spp = Number(program.get("spend_per_point"));
  if (spp && spp > 0) out.spendPerPoint = spp;

  const bill = Number(txn.get("bill_amount")) || 0;

  // Minimum spend gates points too, not just stamps: a points-only sale below the
  // merchant's floor must not earn.
  const minSpend = Number(program.get("min_spend_amount")) || 0;
  if (minSpend > 0 && bill < minSpend) {
    out.skip = true;
    out.reason = "below_min_spend";
    return out;
  }

  out.basePoints = Math.floor(bill / out.spendPerPoint);

  // Campaign bonuses only make sense on a real sale. The birthday "earn" carries a
  // zero bill and its stamps are applied by birthday_helper, so it must not collect
  // flat bonuses or bonus stamps.
  if (bill > 0) {
    const doubleCamp = activeCampaign(merchantId, "double_points", now);
    if (doubleCamp) {
      out.campaignMultiplier = Number(doubleCamp.get("multiplier")) || 2.0;
      out.campaignIds.double_points = doubleCamp.id;
    }

    const flatCamp = activeCampaign(merchantId, "flat_bonus", now);
    if (flatCamp) {
      out.flatBonus = Number(flatCamp.get("bonus_value")) || 0;
      out.campaignIds.flat_bonus = flatCamp.id;
    }

    const stampCamp = activeCampaign(merchantId, "bonus_stamps", now);
    if (stampCamp) {
      out.bonusStamps = Number(stampCamp.get("bonus_value")) || 0;
      out.campaignIds.bonus_stamps = stampCamp.id;
    }
  }

  out.streakMultiplier = streakMultiplier(customerId);
  out.finalPoints =
    Math.floor(out.basePoints * out.campaignMultiplier * out.streakMultiplier) + out.flatBonus;
  return out;
}

/** Derived ledger: users.total_points is always the sum of the customer's cards. */
function recomputeTotalPoints(customerId) {
  if (!customerId) return 0;
  try {
    const model = new DynamicModel({ total: 0 });
    $app
      .db()
      .newQuery("SELECT COALESCE(SUM(points_balance), 0) as total FROM loyalty_cards WHERE customer = {:cid}")
      .bind({ cid: customerId })
      .one(model);
    const total = Number(model.total) || 0;
    const user = $app.findRecordById("users", customerId);
    if (Number(user.get("total_points")) !== total) {
      user.set("total_points", total);
      $app.save(user);
    }
    return total;
  } catch (err) {
    console.log("[POINTS ENGINE] total_points recompute failed:", err && err.message ? err.message : err);
    return 0;
  }
}

/** Side effects, run only once the transaction has been committed. */
function applyEarning(txn) {
  if (txn.get("type") !== "earn") return null;

  const computed = readCalc(txn) || computeEarning(txn);
  if (computed.skip) return computed;

  const card = resolveCard(txn);
  if (!card) return computed;

  if (computed.bonusStamps > 0) {
    card.set("stamps_collected", (Number(card.get("stamps_collected")) || 0) + computed.bonusStamps);
  }
  if (computed.finalPoints > 0) {
    card.set("points_balance", (Number(card.get("points_balance")) || 0) + computed.finalPoints);
  }
  try {
    // Saving the card runs stamp_complete.pb.js (milestones + card completion).
    $app.save(card);
  } catch (err) {
    console.log("[POINTS ENGINE] Card save failed:", err && err.message ? err.message : err);
    return computed;
  }

  // Campaign counters move only after the sale is committed, so a rejected
  // transaction can no longer burn a campaign slot.
  const ids = computed.campaignIds || {};
  Object.keys(ids).forEach(function (type) {
    const id = ids[type];
    if (!id) return;
    try {
      const camp = $app.findRecordById("campaigns", id);
      const maxRed = Number(camp.get("max_redemptions")) || 0;
      const curRed = Number(camp.get("current_redemptions")) || 0;
      if (maxRed > 0 && curRed >= maxRed) return;
      camp.set("current_redemptions", curRed + 1);
      $app.save(camp);
    } catch (err) {
      console.log("[POINTS ENGINE] Campaign counter failed:", err && err.message ? err.message : err);
    }
  });

  recomputeTotalPoints(txn.get("customer"));
  return computed;
}

function readCalc(txn) {
  try {
    const raw = (txn.getString ? txn.getString("metadata") : "") || "";
    if (!raw || raw.trim().charAt(0) !== "{") return null;
    const meta = JSON.parse(raw);
    return meta && meta.points_calc ? meta.points_calc : null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  computeEarning: computeEarning,
  applyEarning: applyEarning,
  recomputeTotalPoints: recomputeTotalPoints,
  resolveCard: resolveCard,
  resolveProgram: resolveProgram,
  DEFAULT_SPEND_PER_POINT: DEFAULT_SPEND_PER_POINT,
};
