// pb_hooks/voucher_redeem.pb.js

onRecordUpdate((e) => {
  const original = e.record.original();
  const prevStatus = original.get('status');
  const newStatus = e.record.get('status');

  // Trigger when voucher status changes to 'used'
  if (prevStatus === 'active' && newStatus === 'used') {
    try {
      const customerId = e.record.get('customer');
      const rewardId = e.record.get('reward');

      // Fetch the reward to find the merchant
      const reward = $app.findRecordById('rewards', rewardId);
      const merchantId = reward.get('merchant');

      // Create transaction ledger record for the redemption
      const txCol = $app.findCollectionByNameOrId('transactions');
      const tx = new Record(txCol);
      tx.set('customer', customerId);
      tx.set('merchant', merchantId);
      tx.set('type', 'redeem');
      tx.set('stamps', 0);
      tx.set('points', 0);
      tx.set('metadata', { voucher_id: e.record.id, reward_id: rewardId });
      
      $app.save(tx);
    } catch (err) {
      console.log("Error logging voucher redemption transaction:", err.message || err);
    }
  }

  return e.next();
}, 'vouchers');
