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
      let merchantId = e.record.get('merchant');
      if (!merchantId && rewardId) {
        try {
          const reward = $app.findRecordById('rewards', rewardId);
          merchantId = reward.get('merchant');
        } catch (rErr) {}
      }

      // If updater is an authenticated merchant, verify they own the merchant
      if (e.auth) {
        const authRole = e.auth.getString('role');
        const authMerchantId = e.auth.getString('merchant_id');
        if ((authRole === 'merchant' || authRole === 'both') && authMerchantId && merchantId && authMerchantId !== merchantId) {
          throw new ForbiddenError('You are not authorized to redeem a voucher for this store.');
        }
      }

      // Create transaction ledger record for the redemption
      const txCol = $app.findCollectionByNameOrId('transactions');
      const tx = new Record(txCol);
      tx.set('customer', customerId);
      tx.set('merchant', merchantId);
      tx.set('type', 'redeem');
      tx.set('stamps', 0);
      tx.set('points', 0);
      
      const meta = {
        voucher_id: e.record.id,
        reward_id: rewardId,
        staff_id: e.auth ? e.auth.id : '',
        staff_name: e.auth ? (e.auth.getString('name') || 'Staff') : '',
        branch_name: e.auth ? (e.auth.getString('branch_name') || 'All Branches (HQ)') : 'All Branches (HQ)',
      };
      tx.set('metadata', JSON.stringify(meta));
      
      $app.save(tx);
    } catch (err) {
      if (err.name === 'ForbiddenError') throw err;
      console.log("Error logging voucher redemption transaction:", err.message || err);
    }
  }

  return e.next();
}, 'vouchers');
