// pb_hooks/resolve_stand.pb.js
// Route: GET /api/risev/nfc/resolve
// Public resolver for NFC stands (supports generic serial codes, self-pairing checks, and legacy merchant IDs)

routerAdd("GET", "/api/risev/nfc/resolve", (e) => {
  let query = {};
  try {
    query = e.requestInfo().query || {};
  } catch (err) {
    try {
      query = $apis.requestInfo(e).query || {};
    } catch (err2) {
      query = {};
    }
  }

  const rawCode = (query.c || query.s || query.code || "").trim().toUpperCase();
  const directMerchantId = (query.m || query.merchant || "").trim();
  const requestedBranchId = (query.b || query.branch || query.branch_id || "").trim();

  // Helper to fetch branch details
  function resolveBranchData(merchantId, branchId) {
    if (!merchantId) return null;
    try {
      if (branchId) {
        const branch = $app.findRecordById("branches", branchId);
        if (branch && branch.getString("merchant") === merchantId) {
          return {
            branch_id: branch.id,
            branch_name: branch.getString("name") || "Outlet",
            branch_address: branch.getString("address") || "",
            branch_city: branch.getString("city") || "",
            branch_google_review_url: branch.getString("google_review_url") || "",
            is_hq: branch.getBool("is_hq")
          };
        }
      }
    } catch (e) {}

    // Fallback: Find HQ branch for this merchant
    try {
      const hqBranches = $app.findRecordsByFilter(
        "branches",
        `merchant = '${merchantId}' && is_hq = true`,
        "-created",
        1,
        0
      );
      if (hqBranches && hqBranches.length > 0) {
        const hq = hqBranches[0];
        return {
          branch_id: hq.id,
          branch_name: hq.getString("name") || "HQ / Main Outlet",
          branch_address: hq.getString("address") || "",
          branch_city: hq.getString("city") || "",
          branch_google_review_url: hq.getString("google_review_url") || "",
          is_hq: true
        };
      }
    } catch (e2) {}

    return null;
  }

  // 1. Direct Merchant ID Lookup (Legacy Support)
  if (directMerchantId) {
    try {
      const merchant = $app.findRecordById("merchants", directMerchantId);
      if (merchant) {
        const branchData = resolveBranchData(merchant.id, requestedBranchId);
        return e.json(200, {
          success: true,
          is_paired: true,
          merchant_id: merchant.id,
          merchant_name: merchant.getString("name") || "Merchant",
          merchant_status: merchant.getString("status") || "active",
          merchant_google_review_url: merchant.getString("google_review_url") || "",
          branch: branchData,
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
        `code = '${rawCode}' || code = "${rawCode}"`,
        "-created",
        1,
        0
      );

      if (codeRecords && codeRecords.length > 0) {
        const codeRec = codeRecords[0];
        const isRedeemed = codeRec.getBool("is_redeemed");
        const redeemedBy = codeRec.getString("redeemed_by");
        const standBranchId = codeRec.getString("branch") || requestedBranchId;
        const plan = codeRec.getString("plan") || "stand_bundle";
        const quota = codeRec.getInt("quota") || 500;

        if (isRedeemed && redeemedBy) {
          // Bound / Paired Stand
          let merchantName = "Merchant";
          let merchantStatus = "active";
          let merchantReviewUrl = "";
          try {
            const merch = $app.findRecordById("merchants", redeemedBy);
            if (merch) {
              merchantName = merch.getString("name") || "Merchant";
              merchantStatus = merch.getString("status") || "active";
              merchantReviewUrl = merch.getString("google_review_url") || "";
            }
          } catch (findMerchErr) {}

          const branchData = resolveBranchData(redeemedBy, standBranchId);

          return e.json(200, {
            success: true,
            is_paired: true,
            merchant_id: redeemedBy,
            merchant_name: merchantName,
            merchant_status: merchantStatus,
            merchant_google_review_url: merchantReviewUrl,
            branch: branchData,
            code: rawCode,
            plan: plan,
            quota: quota,
            source: "activation_code",
          });
        } else {
          // Unclaimed / Unpaired Stand (Fresh Out of Box)
          return e.json(200, {
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
        const branchData = resolveBranchData(merchant.id, requestedBranchId);
        return e.json(200, {
          success: true,
          is_paired: true,
          merchant_id: merchant.id,
          merchant_name: merchant.getString("name") || "Merchant",
          merchant_status: merchant.getString("status") || "active",
          merchant_google_review_url: merchant.getString("google_review_url") || "",
          branch: branchData,
          source: "merchant_id_fallback",
        });
      }
    } catch (e2) {}
  }

  return e.json(404, {
    success: false,
    is_paired: false,
    message: "NFC Stand code or merchant not found",
  });
});
