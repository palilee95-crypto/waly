// pb_hooks/quota_addons.js
// Customer-slot top-ups (merchant_addons) — shared logic.
//
// MUST stay a require()-able module: hook handlers cannot see file-level
// declarations in the same .pb.js file (JSVM handler-scope gotcha), but a
// required module works everywhere.
//
// Pricing is authoritative HERE and nowhere else. The UI fetches it from
// GET /api/risev/merchant/quota/packages instead of hardcoding it.

const PACKAGES = [
  { id: "quota50", quantity: 50, price: 19, label: "+50 members" },
  { id: "quota100", quantity: 100, price: 29, label: "+100 members" },
  { id: "quota500", quantity: 500, price: 99, label: "+500 members" },
  { id: "quota1000", quantity: 1000, price: 179, label: "+1,000 members" }
];

const FREE_DELETIONS = 10;
const DELETIONS_PER_BLOCK = 10;

function findPackage(packageId) {
  const wanted = String(packageId || "").trim();
  for (let i = 0; i < PACKAGES.length; i++) {
    if (PACKAGES[i].id === wanted) return PACKAGES[i];
  }
  return null;
}

// Slots purchased and still valid (expires_at empty = lifetime).
function getActiveAddonQuota(merchantId) {
  if (!merchantId) return 0;
  try {
    const result = new DynamicModel({ total: 0 });
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
    $app.db()
      .newQuery(
        "SELECT COALESCE(SUM(quantity), 0) as total FROM merchant_addons " +
        "WHERE merchant = {:mid} AND type = 'customer_quota' AND status = 'active' " +
        "AND (expires_at IS NULL OR expires_at = '' OR expires_at > {:now})"
      )
      .bind({ mid: merchantId, now: nowStr })
      .one(result);
    return Number(result.total) || 0;
  } catch (err) {
    // Collection missing (migration not applied yet) or query error.
    console.log("[QUOTA ADDONS] Active quota lookup failed:", err.message || err);
    return 0;
  }
}

// Distinct customers, not cards: loyalty_cards is unique per (customer, program),
// so a merchant with two programs must not burn two slots for one person.
function getUsedCustomerCount(merchantId) {
  if (!merchantId) return 0;
  try {
    const result = new DynamicModel({ cnt: 0 });
    $app.db()
      .newQuery("SELECT COUNT(DISTINCT customer) as cnt FROM loyalty_cards WHERE merchant = {:mid}")
      .bind({ mid: merchantId })
      .one(result);
    return Number(result.cnt) || 0;
  } catch (err) {
    console.log("[QUOTA ADDONS] Customer count failed:", err.message || err);
    return 0;
  }
}

// Lifetime stand capacity: sum of the redeemed activation codes.
function getStandQuota(merchantId) {
  if (!merchantId) return 0;
  try {
    const result = new DynamicModel({ total: 0 });
    $app.db()
      .newQuery(
        "SELECT COALESCE(SUM(CASE WHEN quota > 0 THEN quota ELSE 500 END), 0) as total " +
        "FROM activation_codes WHERE redeemed_by = {:mid} AND (is_redeemed = 1 OR is_redeemed = true)"
      )
      .bind({ mid: merchantId })
      .one(result);
    return Number(result.total) || 0;
  } catch (err) {
    console.log("[QUOTA ADDONS] Stand quota lookup failed:", err.message || err);
    return 0;
  }
}

function getDeletionAllowance(addonQuota) {
  const blocks = Math.floor((Number(addonQuota) || 0) / 100);
  return FREE_DELETIONS + blocks * DELETIONS_PER_BLOCK;
}

// Single snapshot for routes/UI so quota math lives in one place.
function getQuotaState(merchantId, plan) {
  const planName = String(plan || "").toLowerCase();
  const addonQuota = getActiveAddonQuota(merchantId);
  const used = getUsedCustomerCount(merchantId);
  const deletionsAllowed = getDeletionAllowance(addonQuota);

  if (planName === "pro" || planName === "business" || planName === "enterprise") {
    return {
      plan: planName,
      used: used,
      base_limit: null,
      addon_quota: addonQuota,
      limit: null,
      remaining: null,
      unlimited: true,
      deletions_allowed: null
    };
  }

  let baseLimit = 0;
  if (planName === "stand_bundle") {
    baseLimit = getStandQuota(merchantId);
    if (baseLimit <= 0) baseLimit = 500;
  } else if (planName === "starter") {
    baseLimit = 300;
  } else {
    baseLimit = getStandQuota(merchantId);
    if (baseLimit <= 0) baseLimit = 500;
  }

  const limit = baseLimit + addonQuota;
  return {
    plan: planName,
    used: used,
    base_limit: baseLimit,
    addon_quota: addonQuota,
    limit: limit,
    remaining: Math.max(0, limit - used),
    unlimited: false,
    deletions_allowed: deletionsAllowed
  };
}

module.exports = {
  PACKAGES: PACKAGES,
  findPackage: findPackage,
  getActiveAddonQuota: getActiveAddonQuota,
  getUsedCustomerCount: getUsedCustomerCount,
  getStandQuota: getStandQuota,
  getDeletionAllowance: getDeletionAllowance,
  getQuotaState: getQuotaState
};
