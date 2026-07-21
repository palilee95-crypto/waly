// pb_hooks/sync_merchant_subscription.pb.js

onRecordCreate((e) => {
  const merchantId = e.record.get('merchant');
  const status = e.record.get('status');
  if (merchantId) {
    try {
      const merchant = $app.findRecordById('merchants', merchantId);
      if (status === 'active') {
        if (merchant.get('status') !== 'active') {
          merchant.set('status', 'active');
          $app.save(merchant);
          console.log("Merchant status automatically activated for paid subscription: ", merchantId);
        }
      }
    } catch (err) {
      console.log("Error activating merchant status for subscription:", err.message || err);
    }
  }
  return e.next();
}, 'subscriptions');

onRecordUpdate((e) => {
  const merchantId = e.record.get('merchant');
  const status = e.record.get('status');
  if (merchantId) {
    try {
      const merchant = $app.findRecordById('merchants', merchantId);
      if (status === 'active') {
        if (merchant.get('status') !== 'active') {
          merchant.set('status', 'active');
          $app.save(merchant);
          console.log("Merchant status activated on subscription update: ", merchantId);
        }
      } else if (status !== 'trialing') {
        if (merchant.get('status') === 'active') {
          merchant.set('status', 'pending');
          $app.save(merchant);
          console.log("Merchant status set to pending on subscription status update: ", status, merchantId);
        }
      }
    } catch (err) {
      console.log("Error updating merchant status on subscription update:", err.message || err);
    }
  }
  return e.next();
}, 'subscriptions');

onRecordDelete((e) => {
  const merchantId = e.record.get('merchant');
  if (merchantId) {
    try {
      const merchant = $app.findRecordById('merchants', merchantId);
      if (merchant.get('status') === 'active') {
        merchant.set('status', 'pending');
        $app.save(merchant);
        console.log("Merchant status reverted to pending on subscription delete: ", merchantId);
      }
    } catch (err) {
      console.log("Error resetting merchant status on subscription delete:", err.message || err);
    }
  }
  return e.next();
}, 'subscriptions');
