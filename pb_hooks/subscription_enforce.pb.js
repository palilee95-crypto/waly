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
        
        // 1. Stand Bundle: Dynamic total customer capacity based on redeemed stand activation codes
        if (plan === 'stand_bundle') {
          let standQuota = 0;
          try {
            const quotaResult = new DynamicModel({ total: 0 });
            $app.db()
              .newQuery("SELECT COALESCE(SUM(CASE WHEN quota > 0 THEN quota ELSE 500 END), 0) as total FROM activation_codes WHERE redeemed_by = {:mid} AND (is_redeemed = 1 OR is_redeemed = true)")
              .bind({ mid: merchantId })
              .one(quotaResult);
            standQuota = Number(quotaResult.total) || 0;
          } catch (qErr) {
            console.log("[SUBSCRIPTION ENFORCE] Stand quota query warning:", qErr.message || qErr);
          }

          if (standQuota <= 0) {
            standQuota = 500;
          }

          try {
            const countResult = new DynamicModel({ cnt: 0 });
            $app.db()
              .newQuery("SELECT COUNT(*) as cnt FROM loyalty_cards WHERE merchant = {:mid}")
              .bind({ mid: merchantId })
              .one(countResult);
            const currentCards = Number(countResult.cnt) || 0;

            if (currentCards >= standQuota) {
              throw new ForbiddenError(
                'You have reached the ' + standQuota.toLocaleString() + ' customer limit included with your NFC Plate package. Please subscribe to Starter (RM47/mo) or PRO (RM97/mo) to enroll new members.'
              );
            }
          } catch (qErr) {
            if (qErr.name === 'ForbiddenError') throw qErr;
          }
        }

        // 2. Starter Plan: 500 customer quota per renewal cycle
        if (plan === 'starter') {
          const subStart = activeSub.getString('created') || activeSub.getString('updated');
          let cycleStart = subStart ? new Date(subStart.replace(' ', 'T')).toISOString().replace('T', ' ').substring(0, 19) : '';
          
          try {
            const filter = cycleStart 
              ? `merchant = '${merchantId}' && created >= '${cycleStart}'` 
              : `merchant = '${merchantId}'`;
            const cycleCards = $app.findRecordsByFilter(
              'loyalty_cards',
              filter,
              '-created',
              505,
              0
            );
            if (cycleCards.length >= 500) {
              throw new ForbiddenError('You have reached your 500 customer quota for this renewal cycle. Renew your subscription or upgrade to PRO for unlimited customers.');
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
