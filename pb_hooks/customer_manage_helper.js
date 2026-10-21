// Shared helpers for the merchant customer-management endpoints.
// Required inside hook handlers: JSVM handlers lose file scope, modules do not.

function parseMetadata(record) {
  try {
    const raw = record.getString("metadata");
    const meta = raw && raw !== "null" ? JSON.parse(raw) : {};
    return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  } catch (err) {
    return {};
  }
}

function resolveMerchant($app, auth) {
  if (!auth) return null;
  let merchantId = "";
  try {
    merchantId = auth.getString("merchant_id") || "";
  } catch (err) {}
  if (!merchantId) {
    try {
      const owned = $app.findRecordsByFilter("merchants", "owner = '" + auth.id + "'", "", 1, 0);
      if (owned && owned.length > 0) merchantId = owned[0].id;
    } catch (err) {}
  }
  if (!merchantId) return null;
  try {
    return $app.findRecordById("merchants", merchantId);
  } catch (err) {
    return null;
  }
}

function isOwner(auth, merchant) {
  return !!auth && !!merchant && merchant.getString("owner") === auth.id;
}

function canManageCustomers($app, auth, merchant) {
  if (!auth || !merchant) return false;
  if (isOwner(auth, merchant)) return true;
  try {
    if (auth.getString("merchant_id") !== merchant.id) return false;
  } catch (err) {
    return false;
  }
  const permissions = parseMetadata(merchant).staff_permissions || {};
  return permissions.can_manage_customers === true;
}

function resolveBranch($app, auth, merchant, requested) {
  let branches = [];
  try {
    branches = $app.findRecordsByFilter(
      "branches",
      "merchant = '" + merchant.id + "'",
      "-is_hq,-created",
      100,
      0
    );
  } catch (err) {}

  let staffBranch = "";
  try {
    staffBranch = auth.getString("branch") || "";
  } catch (err) {}

  let branchId = String(requested || "all") === "all" ? "" : String(requested);
  if (staffBranch) {
    if (branchId && branchId !== staffBranch) return { error: "BRANCH_FORBIDDEN" };
    branchId = staffBranch;
  }

  let isHqBranch = false;
  if (branchId) {
    let found = null;
    for (let i = 0; i < branches.length; i++) {
      if (branches[i].id === branchId) found = branches[i];
    }
    if (!found) return { error: "INVALID_BRANCH" };
    isHqBranch = !!found.getBool("is_hq");
  }

  return { branchId: branchId, isHqBranch: isHqBranch, branches: branches };
}

function customerBelongsToMerchant($app, merchantId, customerId) {
  try {
    const cards = $app.findRecordsByFilter(
      "loyalty_cards",
      "merchant = '" + merchantId + "' && customer = '" + customerId + "'",
      "",
      1,
      0
    );
    return cards.length > 0;
  } catch (err) {
    return false;
  }
}

function normalizePhone(raw) {
  let digits = String(raw || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = "6" + digits;
  if (!digits.startsWith("60") && digits.length >= 9) digits = "60" + digits;
  return "+" + digits;
}

function buildManageContext($app, auth, merchant, requestedBranch) {
  const branch = resolveBranch($app, auth, merchant, requestedBranch);
  if (branch.error) return { error: branch.error };
  return {
    ctx: {
      merchantId: merchant.id,
      branchId: branch.branchId,
      isHqBranch: branch.isHqBranch,
      returnDays: Number(merchant.getInt ? merchant.getInt("inactive_threshold_days") : 0) || 30,
      fromUtc: "",
      toUtc: "",
    },
  };
}

function branchError(e, error) {
  if (error === "BRANCH_FORBIDDEN") {
    return e.json(403, { code: "BRANCH_FORBIDDEN", message: "You can only view your own outlet." });
  }
  return e.json(400, { code: "INVALID_BRANCH", message: "That outlet does not belong to this merchant." });
}

function generateVoucherCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = function (length) {
    let out = "";
    for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  };
  return "WV-" + segment(4) + "-" + segment(4);
}

module.exports = {
  parseMetadata: parseMetadata,
  resolveMerchant: resolveMerchant,
  isOwner: isOwner,
  canManageCustomers: canManageCustomers,
  resolveBranch: resolveBranch,
  buildManageContext: buildManageContext,
  branchError: branchError,
  customerBelongsToMerchant: customerBelongsToMerchant,
  normalizePhone: normalizePhone,
  generateVoucherCode: generateVoucherCode,
};
