const { createNotification } = require(`${__hooks}/notification_helper.js`);

onRecordAfterCreateSuccess((e) => {
  if (e.record.get('type') !== 'earn') return e.next();

  const customerId = e.record.get('customer');
  const merchantId = e.record.get('merchant');
  const cardId = e.record.get('loyalty_card');

  if (!cardId) return e.next();

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

  // Sum points earned in the rolling 12 months specifically at this merchant
  let pointsSum = 0;
  try {
    const result = new DynamicModel({ total: 0 });
    $app.db()
      .newQuery("SELECT SUM(points) as total FROM transactions WHERE customer = {:cid} AND merchant = {:mid} AND type = 'earn' AND created >= {:since}")
      .bind({ cid: customerId, mid: merchantId, since: twelveMonthsAgo })
      .one(result);
    pointsSum = result.total || 0;
  } catch (err) {
    console.log("Tier calculation points sum query failed:", err);
  }

  // Determine new tier (Shop-specific thresholds based on RM spending)
  let newTier = 'bronze';
  if (pointsSum >= 500) {
    newTier = 'platinum';
  } else if (pointsSum >= 300) {
    newTier = 'gold';
  } else if (pointsSum >= 100) {
    newTier = 'silver';
  }

  try {
    const card = $app.findRecordById('loyalty_cards', cardId);
    const oldTier = card.get('tier') || 'bronze';

    if (newTier !== oldTier) {
      // Update specific card's tier
      card.set('tier', newTier);
      $app.save(card);

      // Write tier_history log
      const histCol = $app.findCollectionByNameOrId('tier_history');
      const hist = new Record(histCol);
      hist.set('user', customerId);
      hist.set('old_tier', oldTier);
      hist.set('new_tier', newTier);
      hist.set('points_at_upgrade', pointsSum);
      hist.set('upgrade_date', now.toISOString());
      $app.save(hist);

      // Fetch merchant details for notification branding
      const merchant = $app.findRecordById('merchants', merchantId);
      const merchantName = merchant.get('name') || 'merchant';

      // Send notifications
      const tierEmojis = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '🏆' };
      const emoji = tierEmojis[newTier] || '';
      createNotification(
        customerId,
        `${emoji} Tier Upgraded at ${merchantName}`,
        `Congratulations! You have reached ${newTier.toUpperCase()} membership tier at ${merchantName} with ${pointsSum} rolling points!`,
        'tier',
        { merchant_id: merchantId, new_tier: newTier, points: pointsSum }
      );
    }
  } catch (cardErr) {
    console.log("Failed to process tier recalculation on loyalty card:", cardErr.message || cardErr);
  }

  return e.next();
}, 'transactions');
