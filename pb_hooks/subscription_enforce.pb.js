// pb_hooks/subscription_enforce.pb.js

onRecordCreate((e) => {
  const merchantId = e.record.get('merchant');
  if (merchantId) {
    try {
      const merchant = $app.findRecordById('merchants', merchantId);
      const status = merchant.get('status');
      if (status !== 'active') {
        // Allow if in 7 days free trial (status is 'pending' and created date is within 7 days)
        const createdTime = new Date(merchant.getString('created'));
        const now = new Date();
        const diffMs = now.getTime() - createdTime.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        
        if (status === 'pending' && diffDays >= 0 && diffDays <= 7) {
          // Permitted under Free Trial
        } else {
          throw new ForbiddenError('Your store subscription is suspended or pending. Please complete your subscription payment to continue.');
        }
      }
    } catch (err) {
      if (err.name === 'ForbiddenError') {
        throw err;
      }
      // Fail-open or log on general SQLite lookups to prevent server bricking
      console.log("Subscription check error:", err.message || err);
    }
  }
  return e.next();
}, 'transactions', 'loyalty_programs', 'rewards');
