onRecordCreate((e) => {
  const customerId = e.record.get('customer');
  const rewardId = e.record.get('reward');

  // Fetch reward details
  const reward = $app.findRecordById('rewards', rewardId);
  const merchantId = reward.get('merchant');

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

  const cost = reward.get('points_cost') || 0;
  const balance = card.get('points_balance') || 0;

  if (reward.get('is_active') === false || (reward.get('stock') !== null && reward.get('stock') !== undefined && reward.get('stock') <= 0)) {
    throw new ForbiddenError('This reward is currently unavailable or out of stock.');
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
    points_cost: cost
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

  return e.next();
}, 'redemptions');
