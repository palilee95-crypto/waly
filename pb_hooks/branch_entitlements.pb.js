// pb_hooks/branch_entitlements.pb.js

function risevActivePlan(merchantId) {
  try {
    const subs = $app.findRecordsByFilter("subscriptions",
      `merchant = '${merchantId}' && (status = 'active' || status = 'trialing')`, "-created", 1, 0);
    if (subs.length > 0) return (subs[0].getString("plan") || "starter").toLowerCase();
  } catch (e) {}
  return "starter";
}

function risevBranchLimit(plan) {
  if (plan === "pro") return 999999;
  if (plan === "stand_bundle") return 2;
  return 1; // starter / 7-day trial
}

function risevCountBranches(merchantId) {
  try {
    return $app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 500, 0).length;
  } catch (e) { return 0; }
}

function risevClearOtherHq(merchantId, keepId) {
  try {
    const all = $app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 500, 0);
    all.forEach(b => {
      if (b.id !== keepId && b.getBool("is_hq")) { b.set("is_hq", false); $app.save(b); }
    });
  } catch (e) {}
}

onRecordCreate((e) => {
  const merchantId = e.record.getString("merchant");
  if (!merchantId) return e.next();

  const plan = risevActivePlan(merchantId);
  const limit = risevBranchLimit(plan);
  const existing = risevCountBranches(merchantId);
  if (existing >= limit) {
    throw new ForbiddenError(
      `Your ${plan === "stand_bundle" ? "NFC Stand Package" : "Starter"} plan supports up to ${limit} outlet(s). Upgrade to PRO for unlimited outlets.`
    );
  }

  if (existing === 0) {
    e.record.set("is_hq", true);
  } else if (e.record.getBool("is_hq")) {
    risevClearOtherHq(merchantId, e.record.id);
  }
  return e.next();
}, "branches");

onRecordUpdate((e) => {
  const merchantId = e.record.getString("merchant");
  if (!merchantId) return e.next();

  if (!e.record.getBool("is_hq")) {
    let wasHq = false;
    try { wasHq = e.record.original().getBool("is_hq"); } catch (err) {}
    if (wasHq) {
      let others = 0;
      try {
        const all = $app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 500, 0);
        all.forEach(b => { if (b.id !== e.record.id && b.getBool("is_hq")) others++; });
      } catch (err) {}
      if (others === 0) throw new ForbiddenError("At least one outlet must remain the HQ.");
    }
  } else {
    risevClearOtherHq(merchantId, e.record.id);
  }
  return e.next();
}, "branches");
