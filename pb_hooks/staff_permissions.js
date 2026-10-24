/// <reference path="../pb_data/types.d.ts" />
// Staff permission helpers shared by the record guards.
//
// Permissions live on `merchants.metadata.staff_permissions` and are written
// only by the owner through /api/risev/merchant/staff/permissions.

function readMetadata(merchant) {
  let meta = {};
  try {
    const raw = merchant.getString("metadata");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) meta = parsed;
    }
  } catch (err) {
    meta = {};
  }
  return meta;
}

function permissionsOf(merchant) {
  const meta = readMetadata(merchant);
  const p = meta.staff_permissions || {};
  return {
    can_view_analytics: !!p.can_view_analytics,
    can_manage_rewards: !!p.can_manage_rewards,
    can_manage_customers: !!p.can_manage_customers,
    can_edit_store_profile: !!p.can_edit_store_profile,
    can_manage_branches: !!p.can_manage_branches,
  };
}

function isOwner(auth, merchant) {
  return !!auth && !!merchant && merchant.getString("owner") === auth.id;
}

/** Owner always passes; a staff member needs their merchant's permission bit. */
function staffHasPermission(auth, merchant, key) {
  if (!auth || !merchant) return false;
  if (isOwner(auth, merchant)) return true;
  if (auth.getString("merchant_id") !== merchant.id) return false;
  return permissionsOf(merchant)[key] === true;
}

function merchantFor($app, merchantId) {
  if (!merchantId) return null;
  try {
    return $app.findRecordById("merchants", merchantId);
  } catch (err) {
    return null;
  }
}

/**
 * Throws 403 unless the caller owns the merchant or holds `key`.
 * Must live here (exported): Goja does not expose file-scope functions inside
 * hook callbacks, so the guards call this through require().
 */
function assertPermission($app, e, record, key, label) {
  // Superusers and server-side calls bypass the staff permission matrix.
  try {
    if (!e || (e.hasSuperuserAuth && e.hasSuperuserAuth())) return;
  } catch (err) {}
  const auth = e ? e.auth : null;
  if (!auth) {
    throw new ForbiddenError("Please sign in.");
  }
  const merchantId = record ? record.getString("merchant") : "";
  const merchant = merchantFor($app, merchantId);
  if (!merchant) {
    throw new BadRequestError("Merchant not found.");
  }
  if (!staffHasPermission(auth, merchant, key)) {
    throw new ForbiddenError("Your role cannot " + (label || "do that") + ".");
  }
}

module.exports = {
  readMetadata,
  permissionsOf,
  isOwner,
  staffHasPermission,
  merchantFor,
  assertPermission,
};
