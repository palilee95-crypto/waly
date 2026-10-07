// pb_hooks/sync_merchant_subscription.pb.js

onRecordCreate((e) => {
  const merchantId = e.record.get('merchant');
  const status = e.record.get('status');
  const plan = (e.record.getString('plan') || '').toLowerCase();
  const isProPlan = plan === 'pro' || plan === 'business';

  if (merchantId) {
    try {
      const merchant = $app.findRecordById('merchants', merchantId);
      let updated = false;
      if (status === 'active' || status === 'trialing') {
        if (merchant.get('status') !== 'active') {
          merchant.set('status', 'active');
          updated = true;
        }
        if (isProPlan && merchant.getBool('has_booking_addon') !== true) {
          merchant.set('has_booking_addon', true);
          updated = true;
        } else if (!isProPlan && merchant.getBool('has_booking_addon') === true) {
          merchant.set('has_booking_addon', false);
          updated = true;
        }
      }
      if (updated) {
        $app.save(merchant);
        console.log("Merchant status/addon automatically updated for subscription: ", merchantId);
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
  const plan = (e.record.getString('plan') || '').toLowerCase();
  const isProPlan = plan === 'pro' || plan === 'business';

  if (merchantId) {
    try {
      const merchant = $app.findRecordById('merchants', merchantId);
      let updated = false;
      if (status === 'active' || status === 'trialing') {
        if (merchant.get('status') !== 'active') {
          merchant.set('status', 'active');
          updated = true;
        }
        if (isProPlan && merchant.getBool('has_booking_addon') !== true) {
          merchant.set('has_booking_addon', true);
          updated = true;
        } else if (!isProPlan && merchant.getBool('has_booking_addon') === true) {
          merchant.set('has_booking_addon', false);
          updated = true;
        }
      } else {
        if (merchant.get('status') === 'active') {
          merchant.set('status', 'pending');
          updated = true;
        }
        if (merchant.getBool('has_booking_addon') === true) {
          merchant.set('has_booking_addon', false);
          updated = true;
        }
      }
      if (updated) {
        $app.save(merchant);
        console.log("Merchant status/addon updated on subscription update: ", status, merchantId);
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
      let updated = false;
      if (merchant.get('status') === 'active') {
        merchant.set('status', 'pending');
        updated = true;
      }
      if (merchant.getBool('has_booking_addon') === true) {
        merchant.set('has_booking_addon', false);
        updated = true;
      }
      if (updated) {
        $app.save(merchant);
        console.log("Merchant status/addon reverted on subscription delete: ", merchantId);
      }
    } catch (err) {
      console.log("Error resetting merchant status on subscription delete:", err.message || err);
    }
  }
  return e.next();
}, 'subscriptions');
