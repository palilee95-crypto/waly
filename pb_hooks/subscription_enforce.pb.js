// pb_hooks/subscription_enforce.pb.js

onRecordCreate((e) => {
  const merchantId = e.record.get('merchant');
  if (merchantId) {
    try {
      const merchant = $app.findRecordById('merchants', merchantId);
      const status = merchant.get('status');

      if (status === 'suspended') {
        throw new ForbiddenError('Your store account is suspended. Please contact support.');
      }

      // 1. Check if merchant has an active or trialing subscription record
      let hasValidSub = false;
      try {
        const subs = $app.findRecordsByFilter('subscriptions',
          `merchant = '${merchantId}' && (status = 'active' || status = 'trialing')`,
          '-created', 1, 0);
        if (subs.length > 0) {
          const sub = subs[0];
          const periodEnd = sub.getString('current_period_end');
          if (!periodEnd || new Date(periodEnd).getTime() > Date.now()) {
            hasValidSub = true;
          }
        }
      } catch (subErr) { /* ignore lookup error */ }

      if (hasValidSub || status === 'active') {
        // Permitted under Active or Admin-granted Trial Subscription
      } else {
        // 2. Fall back to initial 7-day free trial for new pending merchants
        const createdTime = new Date(merchant.getString('created'));
        const now = new Date();
        const diffMs = now.getTime() - createdTime.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (status === 'pending' && diffDays >= 0 && diffDays <= 7) {
          // Permitted under initial signup free trial
        } else {
          throw new ForbiddenError('Your store subscription or trial has expired. Please upgrade your subscription to continue.');
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
