// pb_hooks/subscription_enforce_logic.js
// Shared body of the subscription/quota gate.
//
// Why this module exists: inside a `.pb.js` handler, `e.collection` is not
// reliably populated by `onRecordCreate`. The reliable way to know which
// collection fired is to register one tagged handler per collection and tell
// this function explicitly. Hook handlers also cannot see file-level
// declarations, so the logic lives here and is require()d from the handler.

function isForbidden(err) {
  // JSVM exposes error `name` as undefined/null, so `err.name === 'ForbiddenError'`
  // never matches (fail-open). instanceof is reliable; status is the fallback.
  return (err instanceof ForbiddenError) || (err && err.status === 403);
}

function enforce(e, isLoyaltyCard) {
  const merchantId = e.record.get('merchant');

  if (merchantId) {
    try {
      const quota = require(`${__hooks}/quota_addons.js`);
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
      if (isLoyaltyCard && activeSub) {
        const plan = activeSub.getString('plan');

        // 1. Stand Bundle: lifetime capacity = redeemed stands + purchased slot top-ups
        if (plan === 'stand_bundle') {
          let standQuota = quota.getStandQuota(merchantId);
          if (standQuota <= 0) {
            standQuota = 500;
          }
          const addonQuota = quota.getActiveAddonQuota(merchantId);
          const limit = standQuota + addonQuota;

          // Distinct customers, not cards: loyalty_cards is unique per
          // (customer, program), so two programs must not burn two slots.
          const currentCustomers = quota.getUsedCustomerCount(merchantId);

          if (currentCustomers >= limit) {
            throw new ForbiddenError(
              'You have reached your ' + limit.toLocaleString() + ' customer limit. Add more customer slots from your subscription page to enroll new members.'
            );
          }
        }

        // 2. Starter Plan: 300 customer quota per renewal cycle (distinct customers)
        if (plan === 'starter') {
          const subStart = activeSub.getString('created') || activeSub.getString('updated');
          const cycleStart = subStart ? new Date(subStart.replace(' ', 'T')).toISOString().replace('T', ' ').substring(0, 19) : '';

          const countResult = new DynamicModel({ cnt: 0 });
          if (cycleStart) {
            $app.db()
              .newQuery("SELECT COUNT(DISTINCT customer) as cnt FROM loyalty_cards WHERE merchant = {:mid} AND created >= {:start}")
              .bind({ mid: merchantId, start: cycleStart })
              .one(countResult);
          } else {
            $app.db()
              .newQuery("SELECT COUNT(DISTINCT customer) as cnt FROM loyalty_cards WHERE merchant = {:mid}")
              .bind({ mid: merchantId })
              .one(countResult);
          }
          const cycleCustomers = Number(countResult.cnt) || 0;

          if (cycleCustomers >= 300) {
            throw new ForbiddenError('You have reached your 300 customer quota for this renewal cycle. Renew your subscription or upgrade to PRO for unlimited customers.');
          }
        }
      }
    } catch (err) {
      if (isForbidden(err)) {
        throw err;
      }
      // Fail-open on general SQLite lookup errors to avoid bricking the server
      console.log("Subscription check error:", err.message || err);
    }
  }

  return e.next();
}

module.exports = { enforce: enforce };
