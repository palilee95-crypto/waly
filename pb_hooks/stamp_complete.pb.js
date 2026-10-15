// pb_hooks/stamp_complete.pb.js

onRecordUpdate((e) => {
  const prev = e.record.original();
  const prev_stamps = prev.get('stamps_collected');
  const new_stamps  = e.record.get('stamps_collected');
  
  const program = $app.findRecordById('loyalty_programs', e.record.get('program'));
  if (!program || program.get('enable_stamps') === false) {
    return e.next();
  }
  const goal = program.get('stamp_goal');

  // Helper function to generate a random coupon code
  const generateVoucherCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg = (n) => {
      let result = '';
      for (let i = 0; i < n; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    return `WV-${seg(4)}-${seg(4)}`;
  };

  // Helper function to create the voucher record
  const issueVoucher = (customerId, rewardId, campaignId = null, daysValid = 30) => {
    const col = $app.findCollectionByNameOrId('vouchers');
    const v = new Record(col);
    v.set('customer', customerId);
    v.set('reward', rewardId);
    if (campaignId) v.set('campaign', campaignId);
    v.set('code', generateVoucherCode());
    v.set('status', 'active');
    v.set('expires_at', new Date(Date.now() + daysValid * 86400000).toISOString());

    // Snapshot reward details into metadata so future catalog edits don't affect this issued voucher
    try {
      const rewardObj = $app.findRecordById('rewards', rewardId);
      if (rewardObj) {
        let eligibleItemIds = [];
        try {
          const relItems = $app.findRecordsByFilter('reward_eligible_items', `reward = "${rewardId}"`, '-created', 100, 0);
          eligibleItemIds = relItems.map(ri => ri.getString('item')).filter(Boolean);
        } catch (relErr) {}

        v.set('metadata', JSON.stringify({
          snapshot_title: rewardObj.get('name') || rewardObj.get('title') || '',
          snapshot_description: rewardObj.get('description') || '',
          snapshot_type: rewardObj.get('type') || 'free_item',
          discount_type: rewardObj.get('discount_type') || 'none',
          discount_value: parseFloat(rewardObj.get('discount_value')) || 0,
          min_spend: parseFloat(rewardObj.get('min_spend')) || 0,
          max_discount: parseFloat(rewardObj.get('max_discount')) || 0,
          free_quantity: parseInt(rewardObj.get('free_quantity')) || 1,
          merchant_id: rewardObj.get('merchant') || '',
          eligible_item_ids: eligibleItemIds,
          applicable_items_text: rewardObj.get('applicable_items_text') || '',
          discount_scope: rewardObj.get('discount_scope') || 'all',
        }));
      }
    } catch (rErr) {
      console.log('[STAMP COMPLETE] Snapshot note:', rErr.message || rErr);
    }

    $app.save(v);
    return v;
  };

  // Helper to ensure every milestone voucher links to a valid reward record
  const getOrCreateSubRewardRecord = (merchantId, title, type, value) => {
    try {
      const records = $app.findRecordsByFilter(
        'rewards',
        `merchant = "${merchantId}" && name = "${title.replace(/"/g, '\\"')}"`,
        '-created',
        1,
        0
      );
      if (records && records.length > 0) {
        return records[0].id;
      }
    } catch (e) {}

    try {
      const rewardsCol = $app.findCollectionByNameOrId('rewards');
      const r = new Record(rewardsCol);
      r.set('merchant', merchantId);
      r.set('name', title);
      r.set('description', 'Milestone Reward');
      r.set('points_cost', 1);
      r.set('stock', 1000000);
      r.set('is_active', true);
      r.set('type', type === 'free_item' ? 'free_item' : 'discount');
      r.set('discount_value', parseFloat(value) || 0);
      $app.save(r);
      return r.id;
    } catch (err) {
      console.log('[STAMP COMPLETE] Failed to create shadow reward:', err);
      return program.get('linked_reward') || '';
    }
  };

  // Helper function to issue custom sub-reward voucher
  const issueCustomSubVoucher = (customerId, subReward, merchantId, daysValid = 30) => {
    const col = $app.findCollectionByNameOrId('vouchers');
    const v = new Record(col);
    v.set('customer', customerId);

    const rewardId = subReward.linked_reward || getOrCreateSubRewardRecord(
      merchantId,
      subReward.reward_title || 'Milestone Reward',
      subReward.reward_type,
      subReward.reward_value
    );
    if (rewardId) {
      v.set('reward', rewardId);
    } else if (program.get('linked_reward')) {
      v.set('reward', program.get('linked_reward'));
    }

    v.set('code', generateVoucherCode());
    v.set('status', 'active');
    v.set('expires_at', new Date(Date.now() + daysValid * 86400000).toISOString());
    v.set('metadata', JSON.stringify({
      snapshot_title: subReward.reward_title || 'Sub-Reward',
      snapshot_description: `Sub-Reward for Stamp #${subReward.at_stamp}`,
      snapshot_type: subReward.reward_type || 'discount',
      discount_value: parseFloat(subReward.reward_value) || 0,
      merchant_id: merchantId || '',
      is_sub_reward: true,
      at_stamp: subReward.at_stamp
    }));
    $app.save(v);
    return v;
  };

  // 1. Check Intermediate Sub-Rewards (Milestones)
  if (new_stamps > prev_stamps) {
    let subRewards = [];
    try {
      const rawSub = program.get('sub_rewards');
      subRewards = typeof rawSub === 'string' ? JSON.parse(rawSub) : (rawSub || []);
    } catch (err) {}

    if (Array.isArray(subRewards) && subRewards.length > 0) {
      subRewards.forEach(sr => {
        const atStamp = parseInt(sr.at_stamp, 10);
        if (atStamp && atStamp < goal && new_stamps >= atStamp && prev_stamps < atStamp) {
          if (sr.linked_reward) {
            issueVoucher(e.record.get('customer'), sr.linked_reward, null, 30);
          } else if (sr.reward_title) {
            issueCustomSubVoucher(e.record.get('customer'), sr, program.get('merchant'), 30);
          }
        }
      });
    }
  }

  // 2. Check Final Full Goal Completion
  if (new_stamps >= goal && prev_stamps < goal) {
    // Keep card active for the next cycle
    e.record.set('status', 'active');
    e.record.set('completions', (e.record.get('completions') || 0) + 1);
    e.record.set('stamps_collected', 0); // reset for next cycle

    // Issue a voucher for the full completion reward
    const rewardId = program.get('linked_reward');
    if (rewardId) {
      issueVoucher(e.record.get('customer'), rewardId, null, 30);
    }
  }

  return e.next();
}, 'loyalty_cards');
