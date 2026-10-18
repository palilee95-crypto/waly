// pb_hooks/branch_entitlements.pb.js
//
// Outlet limits (starter 1 / stand_bundle 2 / pro unlimited) and the single-HQ
// invariant for the `branches` collection.
//
// IMPORTANT: every helper is declared INSIDE the handler that uses it.
// PocketBase's JSVM does NOT expose file-level function declarations to tagged
// handlers (the handler is pooled/re-evaluated, so file-scope bindings throw
// `ReferenceError`, which PocketBase flattens into a generic 400). Inline logic
// only — that is why no top-level functions appear in this file.

onRecordCreateRequest((e) => {
  function activePlan(merchantId) {
    try {
      const subs = $app.findRecordsByFilter("subscriptions",
        `merchant = '${merchantId}' && (status = 'active' || status = 'trialing')`, "-created", 1, 0);
      if (subs.length > 0) return (subs[0].getString("plan") || "starter").toLowerCase();
    } catch (err) {}
    return "starter";
  }
  function branchLimit(plan) {
    if (plan === "pro") return 999999;
    if (plan === "stand_bundle") return 2;
    return 1; // starter / 7-day trial
  }
  function countBranches(merchantId) {
    try {
      return $app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 500, 0).length;
    } catch (err) { return 0; }
  }

  let isSuperuser = false;
  try { isSuperuser = e.hasSuperuserAuth(); } catch (err) {}
  if (isSuperuser) return e.next();

  const merchantId = e.record.getString("merchant");
  if (!merchantId) return e.next();

  const plan = activePlan(merchantId);
  const limit = branchLimit(plan);
  const existing = countBranches(merchantId);
  if (existing >= limit) {
    throw new ForbiddenError(
      `Your ${plan === "stand_bundle" ? "NFC Stand Package" : "Starter"} plan supports up to ${limit} outlet(s). Upgrade to PRO for unlimited outlets.`
    );
  }

  if (existing === 0) e.record.set("is_hq", true);
  return e.next();
}, "branches");

onRecordUpdateRequest((e) => {
  let isSuperuser = false;
  try { isSuperuser = e.hasSuperuserAuth(); } catch (err) {}
  if (isSuperuser) return e.next();

  const merchantId = e.record.getString("merchant");
  if (!merchantId) return e.next();

  // Guard: never let a merchant reach zero HQ outlets.
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
  }
  return e.next();
}, "branches");

// Clear other HQ ONLY after the incoming record is persisted, so the nested save
// cannot re-enter the guard above and abort the clear.
onRecordAfterCreateSuccess((e) => {
  if (!e.record.getBool("is_hq")) return e.next();
  try {
    const merchantId = e.record.getString("merchant");
    const all = $app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 500, 0);
    all.forEach(b => {
      if (b.id !== e.record.id && b.getBool("is_hq")) { b.set("is_hq", false); $app.save(b); }
    });
  } catch (err) {}
  return e.next();
}, "branches");

onRecordAfterUpdateSuccess((e) => {
  if (!e.record.getBool("is_hq")) return e.next();
  try {
    const merchantId = e.record.getString("merchant");
    const all = $app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 500, 0);
    all.forEach(b => {
      if (b.id !== e.record.id && b.getBool("is_hq")) { b.set("is_hq", false); $app.save(b); }
    });
  } catch (err) {}
  return e.next();
}, "branches");

// Deleting the HQ outlet promotes the oldest remaining outlet.
onRecordDelete((e) => {
  const merchantId = e.record.getString("merchant");
  if (!merchantId) return e.next();
  if (!e.record.getBool("is_hq")) return e.next();

  try {
    const others = $app.findRecordsByFilter("branches",
      `merchant = '${merchantId}' && id != '${e.record.id}'`, "+created", 500, 0);
    const hasHq = others.some(b => b.getBool("is_hq"));
    if (!hasHq && others.length > 0) {
      others[0].set("is_hq", true);
      $app.save(others[0]);
    }
  } catch (err) {}
  return e.next();
}, "branches");
