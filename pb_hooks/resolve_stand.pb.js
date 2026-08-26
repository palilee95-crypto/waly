// pb_hooks/resolve_stand.pb.js
// Route: GET /api/risev/nfc/resolve
// Public resolver for NFC stands (supports generic serial codes, self-pairing checks, and legacy merchant IDs)

routerAdd("GET", "/api/risev/nfc/resolve", (c) => {
  let query = {};
  try {
    query = $apis.requestInfo(c).query || {};
  } catch (e) {
    query = {};
  }

  const rawCode = (query.c || query.s || query.code || "").trim().toUpperCase();
  const directMerchantId = (query.m || query.merchant || "").trim();

  // 1. Direct Merchant ID Lookup (Legacy Support)
  if (directMerchantId) {
    try {
      const merchant = $app.findRecordById("merchants", directMerchantId);
      if (merchant) {
        return c.json(200, {
          success: true,
          is_paired: true,
          merchant_id: merchant.id,
          merchant_name: merchant.getString("name") || "Merchant",
          merchant_status: merchant.getString("status") || "active",
          source: "direct_merchant",
        });
      }
    } catch (mErr) {
      // Fall through to code check
    }
  }

  // 2. Stand Serial / Activation Code Lookup
  if (rawCode) {
    try {
      const codeRecords = $app.findRecordsByFilter(
        "activation_codes",
        `code = "${rawCode}"`,
        "-created",
        1,
        0
      );

      if (codeRecords.length > 0) {
        const codeRec = codeRecords[0];
        const isRedeemed = codeRec.getBool("is_redeemed");
        const redeemedBy = codeRec.getString("redeemed_by");
        const plan = codeRec.getString("plan") || "stand_bundle";
        const quota = codeRec.getInt("quota") || 500;

        if (isRedeemed && redeemedBy) {
          // Bound / Paired Stand
          let merchantName = "Merchant";
          let merchantStatus = "active";
          try {
            const merch = $app.findRecordById("merchants", redeemedBy);
            if (merch) {
              merchantName = merch.getString("name") || "Merchant";
              merchantStatus = merch.getString("status") || "active";
            }
          } catch (findMerchErr) {}

          return c.json(200, {
            success: true,
            is_paired: true,
            merchant_id: redeemedBy,
            merchant_name: merchantName,
            merchant_status: merchantStatus,
            code: rawCode,
            plan: plan,
            quota: quota,
            source: "activation_code",
          });
        } else {
          // Unclaimed / Unpaired Stand (Fresh Out of Box)
          return c.json(200, {
            success: true,
            is_paired: false,
            code: rawCode,
            plan: plan,
            quota: quota,
            source: "unclaimed_code",
          });
        }
      }
    } catch (codeErr) {
      console.log("[RESOLVE STAND ERROR]", codeErr.message || codeErr);
    }

    // Check if rawCode happens to be a merchant ID directly
    try {
      const merchant = $app.findRecordById("merchants", rawCode);
      if (merchant) {
        return c.json(200, {
          success: true,
          is_paired: true,
          merchant_id: merchant.id,
          merchant_name: merchant.getString("name") || "Merchant",
          merchant_status: merchant.getString("status") || "active",
          source: "merchant_id_fallback",
        });
      }
    } catch (e2) {}
  }

  return c.json(404, {
    success: false,
    is_paired: false,
    message: "NFC Stand code or merchant not found",
  });
});
