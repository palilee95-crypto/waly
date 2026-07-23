onRecordCreate((e) => {
  if (e.record.get('type') !== 'earn') return e.next();

  const customerId = e.record.get('customer');
  const merchantId = e.record.get('merchant');
  const now = new Date().toISOString();
  
  // 1. Fetch user's loyalty card for this merchant
  let card;
  const cardId = e.record.get('loyalty_card');
  try {
    if (cardId) {
      card = $app.findRecordById('loyalty_cards', cardId);
    } else {
      card = $app.findFirstRecordByFilter('loyalty_cards', 
        'customer = {:cid} && merchant = {:mid}', 
        { cid: customerId, mid: merchantId }
      );
    }
  } catch (err) {
    console.log("[MULTIPLIER HOOK] Loyalty card lookup failed:", err.message || err);
    return e.next();
  }

  // 2. Fetch tier from card
  const tier = card.get('tier') || 'bronze';

  const TIER_MULTIPLIERS = {
    bronze: 1.0,
    silver: 1.25,
    gold: 1.5,
    platinum: 2.0
  };
  const tierMult = TIER_MULTIPLIERS[tier] || 1.0;

  // 3. Fetch active double_points campaign
  let campaignMult = 1.0;
  try {
    const campaigns = $app.findRecordsByFilter('campaigns',
      `merchant = {:mid} && is_active = true && start_date <= {:now} && end_date >= {:now} && type = 'double_points'`,
      '-created', 1, 0, { mid: merchantId, now }
    );
    if (campaigns.length > 0) {
      const camp = campaigns[0];
      const maxRed = camp.get('max_redemptions') || 0;
      const curRed = camp.get('current_redemptions') || 0;
      if (maxRed === 0 || curRed < maxRed) {
        campaignMult = camp.get('multiplier') || 2.0;
        camp.set('current_redemptions', curRed + 1);
        $app.save(camp);
      }
    }
  } catch (err) {
    console.log("[MULTIPLIER HOOK] Double points campaign error:", err.message || err);
  }

  // 4. Fetch active flat_bonus campaign
  let flatBonus = 0;
  try {
    const flatCampaigns = $app.findRecordsByFilter('campaigns',
      `merchant = {:mid} && is_active = true && start_date <= {:now} && end_date >= {:now} && type = 'flat_bonus'`,
      '-created', 1, 0, { mid: merchantId, now }
    );
    if (flatCampaigns.length > 0) {
      const camp = flatCampaigns[0];
      const maxRed = camp.get('max_redemptions') || 0;
      const curRed = camp.get('current_redemptions') || 0;
      if (maxRed === 0 || curRed < maxRed) {
        flatBonus = camp.get('bonus_value') || 0;
        camp.set('current_redemptions', curRed + 1);
        $app.save(camp);
      }
    }
  } catch (err) {
    console.log("[MULTIPLIER HOOK] Flat bonus campaign error:", err.message || err);
  }

  // 5. Fetch active streak multiplier
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

  // 6. Calculate final points
  const basePoints = e.record.get('bill_amount') || e.record.get('points') || 0; // represent the bill amount
  const finalPoints = Math.floor(basePoints * tierMult * campaignMult * streakMult) + flatBonus;
  e.record.set('points', finalPoints);

  // 7. Fetch active bonus_stamps campaign
  let bonusStamps = 0;
  try {
    const stampCampaigns = $app.findRecordsByFilter('campaigns',
      `merchant = {:mid} && is_active = true && start_date <= {:now} && end_date >= {:now} && type = 'bonus_stamps'`,
      '-created', 1, 0, { mid: merchantId, now }
    );
    if (stampCampaigns.length > 0) {
      const camp = stampCampaigns[0];
      const maxRed = camp.get('max_redemptions') || 0;
      const curRed = camp.get('current_redemptions') || 0;
      if (maxRed === 0 || curRed < maxRed) {
        bonusStamps = camp.get('bonus_value') || 0;
        camp.set('current_redemptions', curRed + 1);
        $app.save(camp);
      }
    }
  } catch (err) {
    console.log("[MULTIPLIER HOOK] Bonus stamps campaign error:", err.message || err);
  }

  if (bonusStamps > 0) {
    const baseStamps = e.record.get('stamps') || 0;
    e.record.set('stamps', baseStamps + bonusStamps);
    
    const currentStamps = card.get('stamps_collected') || 0;
    card.set('stamps_collected', currentStamps + bonusStamps);
  }

  // 8. Update points balance on card
  const newBalance = (card.get('points_balance') || 0) + finalPoints;
  card.set('points_balance', newBalance);

  try {
    $app.save(card); // Saves card and triggers stamp_complete.pb.js checks
  } catch (saveErr) {
    console.log("[MULTIPLIER HOOK] Card save failed:", saveErr.message || saveErr);
  }

  // Log calculation details in metadata JSON while preserving existing source tags
  let existingMetadata = {};
  try {
    const rawMeta = e.record.get('metadata');
    if (typeof rawMeta === 'string' && rawMeta.trim().startsWith('{')) {
      existingMetadata = JSON.parse(rawMeta);
    } else if (rawMeta) {
      try {
        existingMetadata = JSON.parse($json.stringify(rawMeta));
      } catch (pErr) {
        existingMetadata = {};
      }
    }
  } catch (mErr) {}

  const mergedMetadata = Object.assign({}, existingMetadata, {
    base_points: basePoints,
    tier_multiplier: tierMult,
    campaign_multiplier: campaignMult,
    flat_bonus: flatBonus,
    bonus_stamps: bonusStamps,
    streak_multiplier: streakMult,
    calculated_at: now
  });

  e.record.set('metadata', JSON.stringify(mergedMetadata));

  return e.next();
}, 'transactions');
