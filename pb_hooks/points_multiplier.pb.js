onRecordCreate((e) => {
  if (e.record.get('type') !== 'earn') return e.next();

  const customerId = e.record.get('customer');
  const merchantId = e.record.get('merchant');
  const now = new Date().toISOString();
  
  // 1. Fetch user's current tier
  const user = $app.findRecordById('users', customerId);
  const tier = user.get('tier') || 'bronze';

  const TIER_MULTIPLIERS = {
    bronze: 1.0,
    silver: 1.25,
    gold: 1.5,
    platinum: 2.0
  };
  const tierMult = TIER_MULTIPLIERS[tier] || 1.0;

  // 2. Fetch active double_points campaign
  let campaignMult = 1.0;
  try {
    const campaigns = $app.findRecordsByFilter('campaigns',
      `merchant = {:mid} && is_active = true && start_date <= {:now} && end_date >= {:now} && type = 'double_points'`,
      '-created', 1, 0, { mid: merchantId, now }
    );
    if (campaigns.length > 0) {
      campaignMult = campaigns[0].get('multiplier') || 2.0;
    }
  } catch (err) {
    // Ignore error
  }

  // 3. Fetch user's active streak multiplier
  let streakMult = 1.0;
  try {
    const streak = $app.findFirstRecordByFilter('streaks', `user = {:uid}`, { uid: customerId });
    const currentStreak = streak.get('current_streak') || 0;
    if (currentStreak >= 100) {
      streakMult = 1.50; // +50%
    } else if (currentStreak >= 30) {
      streakMult = 1.25; // +25%
    } else if (currentStreak >= 7) {
      streakMult = 1.10; // +10%
    }
  } catch (err) {
    // No streak record yet, ignore
  }

  // 4. Calculate final points
  const basePoints = e.record.get('points') || 0;
  const finalPoints = Math.floor(basePoints * tierMult * campaignMult * streakMult);
  e.record.set('points', finalPoints);

  // Log calculation details in metadata JSON
  const existingMetadata = e.record.get('metadata') || {};
  e.record.set('metadata', Object.assign({}, existingMetadata, {
    base_points: basePoints,
    tier_multiplier: tierMult,
    campaign_multiplier: campaignMult,
    streak_multiplier: streakMult,
    calculated_at: now
  }));

  return e.next();
}, 'transactions');
