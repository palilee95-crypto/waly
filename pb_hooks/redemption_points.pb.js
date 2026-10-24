// Catalogue redemption: spend points on a reward and receive a voucher.
//
// Guards added during the points audit:
//   * only the owning customer may redeem (the collection rule enforces it; this is
//     defence in depth in case the rule is ever loosened);
//   * `min_redeem_points` from the program is honoured — it was previously stored
//     but read by nothing;
//   * `users.total_points` is recomputed so the profile total matches the cards.
onRecordCreate((e) => {
  const customerId = e.record.get('customer');
  const rewardId = e.record.get('reward');

  let authRecord = null;
  try { authRecord = e.auth; } catch (err) {}
  if (authRecord && authRecord.id && customerId !== authRecord.id) {
    throw new ForbiddenError('You can only redeem your own points.');
  }

  // Fetch reward details
  const reward = $app.findRecordById('rewards', rewardId);
  const merchantId = reward.get('merchant');

  // Per-customer cap: 0 / unset means unlimited. Each `redemptions` row is one
  // act of redeeming, so counting them is the number of times this customer has
  // already taken this reward. Stamps and campaign drops are separate paths.
  const maxPerCustomer = Number(reward.get('max_per_customer')) || 0;
  if (maxPerCustomer > 0) {
    let priorCount = 0;
    try {
      priorCount = $app.findRecordsByFilter(
        'redemptions',
        "customer = '" + customerId + "' && reward = '" + rewardId + "'",
        '-created',
        100,
        0
      ).length;
    } catch (countErr) {
      priorCount = 0;
    }
    if (priorCount >= maxPerCustomer) {
      throw new BadRequestError(
        maxPerCustomer === 1
          ? 'You have already redeemed this reward.'
          : 'This reward can be redeemed ' + maxPerCustomer + ' times per customer.'
      );
    }
  }

  // Fetch the specific loyalty card for the merchant
  let card;
  try {
    card = $app.findFirstRecordByFilter('loyalty_cards',
      'customer = {:cid} && merchant = {:mid}',
      { cid: customerId, mid: merchantId }
    );
  } catch (err) {
    throw new ForbiddenError('You do not have an active loyalty card for this store to redeem points.');
  }

  const cost = Number(reward.get('points_cost')) || 0;
  const balance = Number(card.get('points_balance')) || 0;

  // Minimum redemption threshold and the points switch, both configured per program.
  // "Points off" means fully off: no earning AND no spending, so a merchant who
  // pauses points is not still honouring redemptions against old balances.
  let minRedeem = 0;
  let pointsPerRm = 100;
  let pointsEnabled = true;
  try {
    const programId = card.get('program');
    if (programId) {
      const prog = $app.findRecordById('loyalty_programs', programId);
      minRedeem = Number(prog.get('min_redeem_points')) || 0;
      const rate = Number(prog.get('points_per_rm'));
      if (rate > 0) pointsPerRm = rate;
      pointsEnabled = prog.get('enable_points') !== false;
    }
  } catch (err) {}

  if (!pointsEnabled) {
    throw new ForbiddenError('This store has paused points. Your balance is safe — redemption will work again once they turn points back on.');
  }

  if (reward.get('is_active') === false || (reward.get('stock') !== null && reward.get('stock') !== undefined && reward.get('stock') <= 0)) {
    throw new ForbiddenError('This reward is currently unavailable or out of stock.');
  }

  if (minRedeem > 0 && cost < minRedeem) {
    throw new ForbiddenError('This reward is below the minimum of ' + minRedeem + ' points for this store.');
  }

  if (balance < cost) {
    throw new ForbiddenError('Insufficient points at this shop for this reward redemption.');
  }

  // Deduct points from the loyalty card balance
  card.set('points_balance', balance - cost);
  $app.save(card);

  // Create immutable transaction ledger record for the debit
  const txCol = $app.findCollectionByNameOrId('transactions');
  const tx = new Record(txCol);
  tx.set('customer', customerId);
  tx.set('merchant', merchantId);
  tx.set('loyalty_card', card.id);
  tx.set('type', 'redeem');
  tx.set('points', -cost);
  tx.set('metadata', JSON.stringify({
    reward_redemption: e.record.id || '',
    reward_id: rewardId,
    reward_title: reward.get('name') || reward.get('title') || '',
    points_cost: cost,
    points_per_rm: pointsPerRm
  }));
  $app.save(tx);

  // Issue the corresponding active voucher
  const voucherCol = $app.findCollectionByNameOrId('vouchers');
  const voucher = new Record(voucherCol);
  voucher.set('customer', customerId);
  voucher.set('reward', rewardId);
  voucher.set('code', e.record.get('code'));
  voucher.set('status', 'active');
  // Default voucher validity of 30 days
  const expiry = new Date(Date.now() + 30 * 86400000).toISOString();
  voucher.set('expires_at', expiry);
  voucher.set('metadata', JSON.stringify({
    reward_id: rewardId,
    merchant_id: merchantId,
    title: reward.get('name') || reward.get('title') || 'Reward Voucher',
    description: reward.get('description') || '',
    reward_type: reward.get('type') || 'free_item',
    discount_type: reward.get('discount_type') || '',
    discount_value: reward.get('discount_value') || '',
    applicable_items_text: reward.get('applicable_items_text') || '',
    discount_scope: reward.get('discount_scope') || 'all',
    source: 'points_redemption'
  }));
  $app.save(voucher);

  // Keep the derived profile total in step with the card balance.
  try {
    const engine = require(`${__hooks}/points_engine.js`);
    engine.recomputeTotalPoints(customerId);
  } catch (err) {
    console.log('[REDEMPTION] total_points recompute failed:', err && err.message ? err.message : err);
  }

  return e.next();
}, 'redemptions');
