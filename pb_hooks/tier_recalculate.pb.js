const { createNotification } = require(`${__hooks}/notification_helper.js`);

onRecordAfterCreateSuccess((e) => {
  if (e.record.get('type') !== 'earn') return e.next();

  const customerId = e.record.get('customer');
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Sum points earned in the rolling 12 months
  let pointsSum = 0;
  try {
    const result = new DynamicModel({ total: 0 });
    $app.db()
      .newQuery("SELECT SUM(points) as total FROM transactions WHERE customer = {:cid} AND type = 'earn' AND created >= {:since}")
      .bind({ cid: customerId, since: twelveMonthsAgo })
      .one(result);
    pointsSum = result.total || 0;
  } catch (err) {
    console.log("Tier calculation points sum query failed:", err);
  }

  // Determine new tier
  let newTier = 'bronze';
  if (pointsSum >= 10000) {
    newTier = 'platinum';
  } else if (pointsSum >= 5000) {
    newTier = 'gold';
  } else if (pointsSum >= 2000) {
    newTier = 'silver';
  }

  const user = $app.findRecordById('users', customerId);
  const oldTier = user.get('tier') || 'bronze';

  if (newTier !== oldTier) {
    // Update user's tier
    user.set('tier', newTier);
    $app.save(user);

    // Write tier_history log
    const histCol = $app.findCollectionByNameOrId('tier_history');
    const hist = new Record(histCol);
    hist.set('user', customerId);
    hist.set('old_tier', oldTier);
    hist.set('new_tier', newTier);
    hist.set('points_at_upgrade', pointsSum);
    hist.set('upgrade_date', now.toISOString());
    $app.save(hist);

    // Send notifications
    const tierEmojis = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '🏆' };
    const emoji = tierEmojis[newTier] || '';
    createNotification(
      customerId,
      `${emoji} Tier Upgraded: ${newTier.toUpperCase()}`,
      `Congratulations! You have reached ${newTier.toUpperCase()} membership tier with ${pointsSum} rolling points!`,
      'tier',
      { new_tier: newTier, points: pointsSum }
    );
  }

  return e.next();
}, 'transactions');
