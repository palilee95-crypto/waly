onRecordCreate((e) => {
  const customerId = e.record.get('customer');
  const rewardId = e.record.get('reward');

  // Fetch customer and reward
  const user = $app.findRecordById('users', customerId);
  const reward = $app.findRecordById('rewards', rewardId);

  const cost = reward.get('points_cost') || 0;
  const balance = user.get('total_points') || 0;

  if (balance < cost) {
    throw new ForbiddenError('Insufficient points for this reward redemption');
  }

  // Deduct points atomically
  $app.db()
    .newQuery('UPDATE users SET total_points = total_points - {:pts} WHERE id = {:id}')
    .bind({ pts: cost, id: customerId })
    .execute();

  // Create immutable transaction ledger record for the debit
  const txCol = $app.findCollectionByNameOrId('transactions');
  const tx = new Record(txCol);
  tx.set('customer', customerId);
  tx.set('merchant', reward.get('merchant'));
  tx.set('type', 'redeem');
  tx.set('points', -cost);
  tx.set('metadata', { reward_redemption: e.record.id || '' });
  $app.save(tx);

  return e.next();
}, 'redemptions');
