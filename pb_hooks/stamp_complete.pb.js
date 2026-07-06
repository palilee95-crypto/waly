// pb_hooks/stamp_complete.pb.js

onRecordUpdate((e) => {
  const prev = e.record.original();
  const prev_stamps = prev.get('stamps_collected');
  const new_stamps  = e.record.get('stamps_collected');
  
  const program = $app.findRecordById('loyalty_programs', e.record.get('program'));
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
