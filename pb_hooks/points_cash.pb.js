// Points -> money, customer side.
//
//   POST /api/risev/customer/points/convert  { points, merchant_id? , card_id? }
//
// Converts a number of points into a fixed-value discount voucher using the
// merchant's own rate (`points_per_rm`), honouring `min_redeem_points`.
// The return endpoint enforces `max_redeem_percent` against a real bill.
//
// Everything runs server-side so the rate and the balance cannot be tampered with.
routerAdd("POST", "/api/risev/customer/points/convert", (e) => {
  const CASH_REWARD_NAME = "Points Cash Voucher";

  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to convert points." });
  }

  const body = (e.requestInfo() && e.requestInfo().body) || {};
  const requested = Math.floor(Number(body.points) || 0);
  if (!(requested > 0)) {
    return e.json(400, { code: "INVALID_POINTS", message: "Enter how many points to convert." });
  }

  // The customer's own card decides the merchant — never a client-supplied merchant.
  let card = null;
  try {
    if (body.card_id) {
      card = $app.findRecordById("loyalty_cards", String(body.card_id));
      if (card.get("customer") !== authRecord.id) {
        return e.json(403, { code: "NOT_YOUR_CARD", message: "That card belongs to another customer." });
      }
    } else if (body.merchant_id) {
      card = $app.findFirstRecordByFilter(
        "loyalty_cards",
        "customer = {:cid} && merchant = {:mid}",
        { cid: authRecord.id, mid: String(body.merchant_id) }
      );
    } else {
      return e.json(400, { code: "MERCHANT_REQUIRED", message: "Which store is this for?" });
    }
  } catch (err) {
    return e.json(404, { code: "NO_CARD", message: "You do not have a loyalty card at this store." });
  }
  if (!card) {
    return e.json(404, { code: "NO_CARD", message: "You do not have a loyalty card at this store." });
  }

  const merchantId = card.get("merchant");
  const balance = Number(card.get("points_balance")) || 0;

  let program = null;
  try {
    const programId = card.get("program");
    if (programId) program = $app.findRecordById("loyalty_programs", programId);
  } catch (err) {}
  if (!program) {
    return e.json(400, { code: "NO_PROGRAM", message: "This store has no loyalty program configured." });
  }
  if (program.get("enable_points") === false) {
    return e.json(400, { code: "POINTS_DISABLED", message: "This store is not running points right now." });
  }

  const rate = Number(program.get("points_per_rm")) > 0 ? Number(program.get("points_per_rm")) : 100;
  const minRedeem = Number(program.get("min_redeem_points")) || 0;

  if (minRedeem > 0 && requested < minRedeem) {
    return e.json(400, {
      code: "BELOW_MIN_REDEEM",
      message: "This store requires at least " + minRedeem + " points per redemption.",
    });
  }
  if (requested > balance) {
    return e.json(400, {
      code: "INSUFFICIENT_POINTS",
      message: "You only have " + balance + " points at this store.",
    });
  }

  // Integer sen, rounded down — never promise more cash than the rate allows.
  const valueSen = Math.floor((requested * 100) / rate);
  if (valueSen < 1) {
    return e.json(400, {
      code: "VALUE_TOO_SMALL",
      message: "That many points is worth less than RM 0.01 at this store's rate.",
    });
  }

  // A voucher must point at a reward (vouchers.reward is required and PocketBase
  // treats `is_active: false` as blank on a required bool, so it cannot simply be
  // deactivated). It is created archived instead, and the customer catalogue filters
  // `is_archived != true`, so customers never see it.
  function getOrCreateCashReward() {
    try {
      const found = $app.findFirstRecordByFilter(
        "rewards",
        "merchant = {:mid} && name = {:name}",
        { mid: merchantId, name: CASH_REWARD_NAME }
      );
      if (found) return found;
    } catch (err) {}
    const col = $app.findCollectionByNameOrId("rewards");
    const rec = new Record(col);
    rec.set("merchant", merchantId);
    rec.set("name", CASH_REWARD_NAME);
    rec.set("description", "Points converted into a cash discount voucher");
    rec.set("points_cost", 1);
    rec.set("type", "cash_credit");
    rec.set("discount_type", "fixed_amount");
    rec.set("is_active", true);
    rec.set("is_archived", true);
    $app.save(rec);
    return rec;
  }

  let cashReward = null;
  try {
    cashReward = getOrCreateCashReward();
  } catch (err) {
    console.log("[POINTS CASH] Reward lookup failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "CONVERT_FAILED", message: "Could not prepare the voucher." });
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function randomCode() {
    let raw = "";
    for (let i = 0; i < 8; i++) {
      raw += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return "PC-" + raw.substring(0, 4) + "-" + raw.substring(4);
  }

  const code = randomCode();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const maxPercent = Number(program.get("max_redeem_percent")) || 0;

  try {
    // 1. Debit the balance.
    card.set("points_balance", balance - requested);
    $app.save(card);

    // 2. Ledger row for the debit.
    const txCol = $app.findCollectionByNameOrId("transactions");
    const tx = new Record(txCol);
    tx.set("customer", authRecord.id);
    tx.set("merchant", merchantId);
    tx.set("loyalty_card", card.id);
    tx.set("type", "redeem");
    tx.set("points", -requested);
    tx.set("metadata", JSON.stringify({
      points_conversion: true,
      points: requested,
      points_per_rm: rate,
      value_sen: valueSen,
      voucher_code: code,
    }));
    $app.save(tx);

    // 3. The voucher itself.
    const voucherCol = $app.findCollectionByNameOrId("vouchers");
    const voucher = new Record(voucherCol);
    voucher.set("customer", authRecord.id);
    voucher.set("reward", cashReward.id);
    voucher.set("code", code);
    voucher.set("status", "active");
    voucher.set("expires_at", expiresAt);
    voucher.set("metadata", JSON.stringify({
      source: "points_conversion",
      merchant_id: merchantId,
      reward_id: cashReward.id,
      title: "RM " + (valueSen / 100).toFixed(2) + " Points Discount",
      description: requested + " points converted at " + rate + " points per RM 1.00",
      reward_type: "cash_credit",
      discount_type: "fixed_amount",
      discount_value: valueSen / 100,
      discount_scope: "all",
      points: requested,
      points_per_rm: rate,
      max_redeem_percent: maxPercent,
    }));
    $app.save(voucher);

    const engine = require(`${__hooks}/points_engine.js`);
    const total = engine.recomputeTotalPoints(authRecord.id);

    return e.json(200, {
      success: true,
      balance: balance - requested,
      totalPoints: total,
      voucher: { id: voucher.id, code: code, valueSen: valueSen, expiresAt: expiresAt },
    });
  } catch (err) {
    console.log("[POINTS CASH] Conversion failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "CONVERT_FAILED", message: "Could not convert the points." });
  }
});
