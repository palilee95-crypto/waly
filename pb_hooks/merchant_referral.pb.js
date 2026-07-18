// pb_hooks/merchant_referral.pb.js

onRecordCreate((e) => {
  const referralCode = e.record.get('referral_code');
  if (referralCode) {
    try {
      // Find the sales agent who owns this referral code
      const agent = $app.findFirstRecordByData("sales_agents", "referral_code", referralCode);
      if (agent) {
        e.record.set('referred_by', agent.id);
        console.log(`[REFERRAL HOOK] Merchant ${e.record.id} successfully linked to agent ${agent.id} via code ${referralCode}`);
      } else {
        console.log(`[REFERRAL HOOK] Agent not found for referral code: ${referralCode}`);
      }
    } catch (err) {
      console.log(`[REFERRAL HOOK] Error resolving referral code ${referralCode}:`, err.message || err);
    }
  }
  return e.next();
}, "merchants");
