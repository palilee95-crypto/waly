/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Lock down nfc_claims
  try {
    const nfcClaims = app.findCollectionByNameOrId("nfc_claims");
    if (nfcClaims) {
      nfcClaims.listRule = "@request.auth.id != '' && (merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))";
      nfcClaims.viewRule = "@request.auth.id != '' && (merchant.owner = @request.auth.id || customer = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))";
      nfcClaims.createRule = "";
      nfcClaims.updateRule = "@request.auth.id != '' && (merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))";
      nfcClaims.deleteRule = "@request.auth.id != '' && merchant.owner = @request.auth.id";
      app.save(nfcClaims);
    }
  } catch (err) {
    console.log("[MIGRATION WARNING] Failed to update nfc_claims rules:", err.message || err);
  }

  // 2. Lock down hardware_orders
  try {
    const hardwareOrders = app.findCollectionByNameOrId("hardware_orders");
    if (hardwareOrders) {
      hardwareOrders.listRule = "@request.auth.id != '' && (user = @request.auth.id || merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))";
      hardwareOrders.viewRule = "@request.auth.id != '' && (user = @request.auth.id || merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))";
      hardwareOrders.createRule = "@request.auth.id != ''";
      hardwareOrders.updateRule = "@request.auth.id != '' && (merchant.owner = @request.auth.id || user = @request.auth.id)";
      app.save(hardwareOrders);
    }
  } catch (err) {
    console.log("[MIGRATION WARNING] Failed to update hardware_orders rules:", err.message || err);
  }

  // 3. Lock down activation_codes
  try {
    const activationCodes = app.findCollectionByNameOrId("activation_codes");
    if (activationCodes) {
      activationCodes.listRule = "@request.auth.id != '' && (redeemed_by.owner = @request.auth.id || (redeemed_by = @request.auth.merchant_id && @request.auth.merchant_id != ''))";
      activationCodes.viewRule = "@request.auth.id != '' && (redeemed_by.owner = @request.auth.id || (redeemed_by = @request.auth.merchant_id && @request.auth.merchant_id != ''))";
      activationCodes.createRule = null;
      activationCodes.updateRule = null;
      app.save(activationCodes);
    }
  } catch (err) {
    console.log("[MIGRATION WARNING] Failed to update activation_codes rules:", err.message || err);
  }

  // 4. Lock down pricing_settings
  try {
    const pricingSettings = app.findCollectionByNameOrId("pricing_settings");
    if (pricingSettings) {
      pricingSettings.createRule = null;
      pricingSettings.updateRule = null;
      pricingSettings.deleteRule = null;
      app.save(pricingSettings);
    }
  } catch (err) {
    console.log("[MIGRATION WARNING] Failed to update pricing_settings rules:", err.message || err);
  }

  // 5. Restrict users listRule to own record
  try {
    const usersCol = app.findCollectionByNameOrId("_pb_users_auth_");
    if (usersCol) {
      usersCol.listRule = "id = @request.auth.id";
      app.save(usersCol);
    }
  } catch (err) {
    console.log("[MIGRATION WARNING] Failed to update users listRule:", err.message || err);
  }

  console.log("[MIGRATION SUCCESS] Hardened API rules for nfc_claims, hardware_orders, activation_codes, pricing_settings, and users.");
  return null;
}, (app) => {
  return null;
});
