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

  if (new_stamps >= goal && prev_stamps < goal) {
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
          }));
        }
      } catch (rErr) {
        console.log('[STAMP COMPLETE] Snapshot note:', rErr.message || rErr);
      }

      $app.save(v);
      return v;
    };

    // Keep card active for the next cycle
    e.record.set('status', 'active');
    e.record.set('completions', (e.record.get('completions') || 0) + 1);
    e.record.set('stamps_collected', 0); // reset for next cycle

    // Issue a voucher for the reward
    const rewardId = program.get('linked_reward');
    if (rewardId) {
      issueVoucher(e.record.get('customer'), rewardId, null, 30);
    }
  }

  return e.next();
}, 'loyalty_cards');
