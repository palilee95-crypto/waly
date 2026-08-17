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

      // Check if merchant has an active subscription record
      let hasValidSub = false;
      let activeSub = null;
      try {
        const subs = $app.findRecordsByFilter('subscriptions',
          `merchant = '${merchantId}' && status = 'active'`,
          '-created', 1, 0);
        if (subs.length > 0) {
          activeSub = subs[0];
          const periodEnd = activeSub.getString('current_period_end');
          if (!periodEnd || new Date(periodEnd).getTime() > Date.now()) {
            hasValidSub = true;
          }
        }
      } catch (subErr) { /* ignore lookup error */ }

      if (!hasValidSub) {
        throw new ForbiddenError('Your store subscription is inactive or expired. Please subscribe to continue.');
      }

      // Enforce customer quota limits when registering new customers (adding loyalty cards)
      if (e.collection && e.collection.name === 'loyalty_cards' && activeSub) {
        const plan = activeSub.getString('plan');
        
        // 1. Stand Bundle: Fixed 500 total customer capacity (Lifetime pool)
        if (plan === 'stand_bundle') {
          try {
            const allCards = $app.findRecordsByFilter(
              'loyalty_cards',
              `merchant = '${merchantId}'`,
              '-created',
              505,
              0
            );
            if (allCards.length >= 500) {
              throw new ForbiddenError(
                'You have reached the 500 customer limit included with your NFC Plate. Please subscribe to Starter (RM47/mo) or PRO (RM97/mo) to enroll new members.'
              );
            }
          } catch (qErr) {
            if (qErr.name === 'ForbiddenError') throw qErr;
          }
        }

        // 2. Starter Plan: 500 new customers per month (Resets monthly)
        if (plan === 'starter') {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().replace('T', ' ').substring(0, 19);
          
          try {
            const monthlyCards = $app.findRecordsByFilter(
              'loyalty_cards',
              `merchant = '${merchantId}' && created >= '${startOfMonth}'`,
              '-created',
              505,
              0
            );
            if (monthlyCards.length >= 500) {
              throw new ForbiddenError('Monthly customer quota reached (500/500). Quota resets next billing month, or upgrade to PRO for unlimited customers.');
            }
          } catch (qErr) {
            if (qErr.name === 'ForbiddenError') throw qErr;
          }
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
}, 'transactions', 'loyalty_programs', 'rewards', 'loyalty_cards');
