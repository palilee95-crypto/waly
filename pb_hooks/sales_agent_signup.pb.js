// pb_hooks/sales_agent_signup.pb.js

onRecordCreate((e) => {
  // Set defaults
  e.record.set('commission_tier', 'tier_1');
  e.record.set('status', 'active');
  e.record.set('clicks', 0);
  e.record.set('lifetime_earnings', 0);

  // Auto-generate referral code if not provided
  let ref = e.record.get('referral_code') || '';
  if (!ref) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'WALY_';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    e.record.set('referral_code', code);
    console.log(`[AGENT SIGNUP HOOK] Automatically generated referral code ${code} for agent ${e.record.id}`);
  }

  return e.next();
}, "sales_agents");
