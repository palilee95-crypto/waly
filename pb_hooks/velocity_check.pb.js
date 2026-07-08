onRecordCreate((e) => {
  if (e.record.get('type') !== 'earn') return e.next();

  const customerId = e.record.get('customer');
  const merchantId = e.record.get('merchant');
  
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const minuteAgo = new Date(now.getTime() - 60000);

  // Helper function to create fraud flag (inlined to avoid Goja context garbage collection issues)
  const createFlag = (userId, txnId, ruleId, description, severity) => {
    try {
      const col = $app.findCollectionByNameOrId('fraud_flags');
      const flag = new Record(col);
      flag.set('user', userId);
      if (txnId) flag.set('transaction', txnId);
      flag.set('rule_id', ruleId);
      flag.set('description', description);
      flag.set('status', 'open');
      flag.set('severity', severity);
      $app.save(flag);
    } catch (err) {
      // Ignore flag creation error
    }
  };

  // 0. Frozen account check
  const user = $app.findRecordById('users', customerId);
  const metadata = user.get('metadata') || {};
  if (metadata.frozen) {
    throw new ForbiddenError('Account is temporarily frozen for review. Contact support@risev.app.');
  }

  // 1. Self-issuance check (V05)
  const merchant = $app.findRecordById('merchants', merchantId);
  if (merchant.get('owner') === customerId) {
    // Create fraud flag
    createFlag(customerId, null, 'V05', 'Self-issuance attempt blocked', 'critical');
    throw new ForbiddenError('Self-issuance is not permitted');
  }

  // 2. Daily count check (V01)
  let dailyCount = 0;
  try {
    const dailyResult = new DynamicModel({ cnt: 0 });
    $app.db()
      .newQuery("SELECT COUNT(*) as cnt FROM transactions WHERE customer = {:cid} AND merchant = {:mid} AND type = 'earn' AND created >= {:since}")
      .bind({ cid: customerId, mid: merchantId, since: todayStart.toISOString() })
      .one(dailyResult);
    dailyCount = dailyResult.cnt;
  } catch (err) {
    console.log("Daily limit query failed:", err);
  }

  if (dailyCount >= 5) {
    createFlag(customerId, null, 'V01', `Daily transaction limit exceeded (${dailyCount} today)`, 'high');
    throw new TooManyRequestsError('Daily transaction limit reached for this shop');
  }

  // 3. 60-second cooldown check (V06)
  let recentCount = 0;
  try {
    const recentResult = new DynamicModel({ cnt: 0 });
    $app.db()
      .newQuery("SELECT COUNT(*) as cnt FROM transactions WHERE customer = {:cid} AND merchant = {:mid} AND type = 'earn' AND created >= {:since}")
      .bind({ cid: customerId, mid: merchantId, since: minuteAgo.toISOString() })
      .one(recentResult);
    recentCount = recentResult.cnt;
  } catch (err) {
    console.log("Recent limit query failed:", err);
  }

  if (recentCount >= 2) {
    throw new TooManyRequestsError('Please wait 60 seconds before issuing another stamp');
  }

  return e.next();
}, 'transactions');
