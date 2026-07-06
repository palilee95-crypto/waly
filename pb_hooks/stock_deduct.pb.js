onRecordAfterCreateSuccess((e) => {
  const rewardId = e.record.get('reward');
  const reward = $app.findRecordById('rewards', rewardId);

  const currentStock = reward.get('stock');
  if (currentStock !== null && currentStock !== undefined) {
    const newStock = Math.max(0, currentStock - 1);
    reward.set('stock', newStock);
    if (newStock === 0) {
      reward.set('is_active', false);
    }
    $app.save(reward);
  }

  return e.next();
}, 'redemptions');
