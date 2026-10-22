// pb_hooks/stamp_complete.pb.js

onRecordUpdate((e) => {
  try {
    const cardId = e.record.id;
    const prev = e.record.original();
    const prev_stamps = prev ? (parseInt(prev.get('stamps_collected'), 10) || 0) : 0;
    const new_stamps  = parseInt(e.record.get('stamps_collected'), 10) || 0;
    
    const programId = e.record.get('program');
    if (!programId) {
      return e.next();
    }

    let program = null;
    try {
      program = $app.findRecordById('loyalty_programs', programId);
    } catch (pErr) {
      console.log(`[STAMP COMPLETE] Program ${programId} not found:`, pErr.message || pErr);
      return e.next();
    }

    if (!program || program.get('enable_stamps') === false) {
      return e.next();
    }
    const goal = parseInt(program.get('stamp_goal'), 10) || 10;
    const customerId = e.record.get('customer');
    const merchantId = program.get('merchant') || e.record.get('merchant');

    // The milestone editor saves reward_type as free_item / discount_amount /
    // discount_percent (with 'discount' from the first editor). The checkout
    // only understands fixed_amount / percentage / none, so map explicitly —
    // an unknown value silently became "no discount" but still consumed the
    // voucher.
    const toDiscountType = (rewardType) => {
      const value = String(rewardType || '').toLowerCase();
      if (value === 'discount_amount' || value === 'discount') return 'fixed_amount';
      if (value === 'discount_percent') return 'percentage';
      return 'none';
    };

    console.log(`[STAMP COMPLETE] Card ${cardId}: prev_stamps=${prev_stamps}, new_stamps=${new_stamps}, goal=${goal}, customer=${customerId}`);

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
    const issueVoucher = (custId, rewardId, campaignId = null, daysValid = 30) => {
      try {
        const col = $app.findCollectionByNameOrId('vouchers');
        const v = new Record(col);
        v.set('id', $security.randomString(15).toLowerCase());
        v.set('customer', custId);
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
              merchant_id: rewardObj.get('merchant') || merchantId || '',
              eligible_item_ids: eligibleItemIds,
              applicable_items_text: rewardObj.get('applicable_items_text') || '',
              discount_scope: rewardObj.get('discount_scope') || 'all',
            }));
          }
        } catch (rErr) {
          console.log('[STAMP COMPLETE] Snapshot note:', rErr.message || rErr);
        }

        $app.save(v);
        console.log(`[STAMP COMPLETE] Issued full goal voucher ${v.getString('code')} to ${custId}`);
        return v;
      } catch (err) {
        console.log('[STAMP COMPLETE] Failed to issue full voucher:', err.message || err);
        return null;
      }
    };

    // Helper to ensure every milestone voucher links to a valid reward record
    const getOrCreateSubRewardRecord = (mId, title, type, value) => {
      try {
        const records = $app.findRecordsByFilter(
          'rewards',
          `merchant = "${mId}" && name = "${title.replace(/"/g, '\\"')}"`,
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
        r.set('id', $security.randomString(15).toLowerCase());
        r.set('merchant', mId);
        r.set('name', title);
        r.set('description', 'Milestone Reward');
        r.set('points_cost', 1);
        r.set('stock', 1000000);
        r.set('is_active', true);
        const shadowDiscountType = toDiscountType(type);
        r.set('type', shadowDiscountType === 'none' ? 'free_item' : 'discount');
        // A milestone worth money has to say so, or the checkout cannot price it.
        r.set('discount_type', shadowDiscountType);
        r.set('discount_value', parseFloat(value) || 0);
        r.set('min_spend', 0);
        r.set('max_discount', 0);
        $app.save(r);
        return r.id;
      } catch (err) {
        console.log('[STAMP COMPLETE] Failed to create shadow reward:', err.message || err);
        return program.get('linked_reward') || '';
      }
    };

    // Helper function to issue custom sub-reward voucher
    const issueCustomSubVoucher = (custId, subReward, mId, daysValid = 30) => {
      try {
        const col = $app.findCollectionByNameOrId('vouchers');
        const v = new Record(col);
        v.set('id', $security.randomString(15).toLowerCase());
        v.set('customer', custId);

        const rewardId = subReward.linked_reward || getOrCreateSubRewardRecord(
          mId,
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
          snapshot_type: subReward.reward_type || 'free_item',
          // Without the type the checkout read the value as an untagged number
          // and fell back to "free item", which zeroed the bill instead of
          // taking the milestone's value off it.
          discount_type: toDiscountType(subReward.reward_type),
          discount_value: parseFloat(subReward.reward_value) || 0,
          min_spend: 0,
          max_discount: 0,
          merchant_id: mId || '',
          is_sub_reward: true,
          at_stamp: subReward.at_stamp
        }));
        $app.save(v);
        console.log(`[STAMP COMPLETE] Successfully issued milestone voucher: ${v.getString('code')} for customer: ${custId}`);
        return v;
      } catch (err) {
        console.log('[STAMP COMPLETE] Error issuing milestone voucher:', err.message || err);
        return null;
      }
    };

    // 1. Check Intermediate Sub-Rewards (Milestones)
    if (new_stamps > prev_stamps) {
      let subRewards = [];
      try {
        let rawStr = '';
        if (typeof program.getString === 'function') {
          rawStr = program.getString('sub_rewards');
        }
        if (!rawStr) {
          const rawVal = program.get('sub_rewards');
          if (typeof rawVal === 'string') {
            rawStr = rawVal;
          } else if (rawVal) {
            try {
              rawStr = JSON.stringify(rawVal);
            } catch (jErr) {}
          }
        }
        if (rawStr && typeof rawStr === 'string' && rawStr.trim()) {
          const parsed = JSON.parse(rawStr);
          subRewards = Array.isArray(parsed) ? parsed : [];
        }
      } catch (err) {
        console.log('[STAMP COMPLETE] Error parsing sub_rewards:', err.message || err);
      }

      console.log(`[STAMP COMPLETE] Found ${subRewards.length} configured sub-reward(s) for program:`, JSON.stringify(subRewards));

      if (Array.isArray(subRewards) && subRewards.length > 0) {
        subRewards.forEach(sr => {
          const atStamp = parseInt(sr.at_stamp, 10);
          console.log(`[STAMP COMPLETE] Evaluating milestone #${atStamp}: prev=${prev_stamps}, new=${new_stamps}, goal=${goal}`);
          if (atStamp && atStamp < goal && new_stamps >= atStamp && prev_stamps < atStamp) {
            console.log(`[STAMP COMPLETE] Triggering milestone voucher for stamp #${atStamp}...`);
            if (sr.linked_reward) {
              issueVoucher(customerId, sr.linked_reward, null, 30);
            } else if (sr.reward_title) {
              issueCustomSubVoucher(customerId, sr, merchantId, 30);
            }
          }
        });
      }
    }

    // 2. Check Final Full Goal Completion
    if (new_stamps >= goal && prev_stamps < goal) {
      // Keep card active for the next cycle
      e.record.set('status', 'active');
      e.record.set('completions', (parseInt(e.record.get('completions'), 10) || 0) + 1);
      e.record.set('stamps_collected', 0); // reset for next cycle

      // Issue a voucher for the full completion reward
      const rewardId = program.get('linked_reward');
      if (rewardId) {
        issueVoucher(customerId, rewardId, null, 30);
      }
    }
  } catch (globalErr) {
    console.log('[STAMP COMPLETE] Unhandled error in hook:', globalErr.message || globalErr);
  }

  return e.next();
}, 'loyalty_cards');
