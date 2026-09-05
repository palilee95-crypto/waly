// pb_hooks/redeem_stand_code.pb.js
// Route: POST /api/risev/merchant/redeem-stand-code

routerAdd("POST", "/api/risev/merchant/redeem-stand-code", (c) => {
  let authRecord = c.auth || null;
  if (!authRecord && typeof c.get === "function") {
    try {
      authRecord = c.get("authRecord");
    } catch (e) {}
  }
  if (!authRecord && c.httpContext) {
    try {
      authRecord = c.httpContext.get("authRecord");
    } catch (e) {}
  }

  // Fallback: If token was passed in Authorization header, resolve user directly
  if (!authRecord) {
    let authHeader = "";
    try {
      if (c.requestInfo && c.requestInfo().headers) {
        authHeader = c.requestInfo().headers["authorization"] || "";
      }
    } catch (e) {}

    if (!authHeader) {
      try {
        authHeader = c.request().header.get("Authorization") || "";
      } catch (e) {}
    }

    if (authHeader) {
      const parts = authHeader.split(" ");
      const token = parts.length === 2 ? parts[1] : parts[0];
      if (token) {
        try {
          authRecord = $app.findAuthRecordByToken(token, $app.settings().recordAuthToken.secret);
        } catch (tokErr) {
          try {
            authRecord = $app.findAuthRecordByToken(token);
          } catch (tokErr2) {}
        }
      }
    }
  }

  if (!authRecord) {
    return c.json(401, { success: false, message: "Authentication required. Please log in first." });
  }

  let merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    // User is a new merchant — auto-create store profile!
    try {
      const merchCol = $app.findCollectionByNameOrId("merchants");
      const newMerch = new Record(merchCol);
      const newMerchId = $security.randomString(15).toLowerCase();
      const userName = authRecord.getString("name") || "My Store";
      const storeName = userName.includes("Store") || userName.includes("Cafe") || userName.includes("Shop")
        ? userName
        : `${userName}'s Store`;

      newMerch.set("id", newMerchId);
      newMerch.set("owner", authRecord.id);
      newMerch.set("name", storeName);
      newMerch.set("status", "active");
      newMerch.set("category", "retail");
      $app.save(newMerch);

      authRecord.set("merchant_id", newMerchId);
      authRecord.set("role", "merchant");
      $app.save(authRecord);

      merchantId = newMerchId;
    } catch (createErr) {
      console.log("[REDEEM STAND AUTO-CREATE MERCHANT ERROR]", createErr.message || createErr);
      return c.json(500, { success: false, message: "Failed to initialize store profile" });
    }
  }

  let body = {};
  try {
    body = c.requestInfo().body || {};
  } catch (e) {
    try {
      body = $apis.requestInfo(c).data || {};
    } catch (e2) {
      body = {};
    }
  }

  const rawCode = (body.code || body.stand_code || "").trim().toUpperCase();
  if (!rawCode) {
    return c.json(400, { success: false, message: "Activation code is required" });
  }

  try {
    // 1. Search for matching unredeemed activation code
    const codes = $app.findRecordsByFilter(
      "activation_codes",
      `code = '${rawCode}' && is_redeemed = false`,
      "-created",
      1,
      0
    );

    if (codes.length === 0) {
      return c.json(400, {
        success: false,
        message: "Invalid or already redeemed activation code. Please check your package card or contact support."
      });
    }

    const codeRecord = codes[0];
    const targetPlan = codeRecord.getString("plan") || "stand_bundle";
    const quota = codeRecord.getInt("quota") || 500;

    // 2. Find or create subscription for this merchant
    let subRecord = null;
    try {
      const existing = $app.findRecordsByFilter(
        "subscriptions",
        `merchant = "${merchantId}"`,
        "-created",
        1,
        0
      );
      if (existing.length > 0) {
        subRecord = existing[0];
      }
    } catch (findErr) {}

    if (!subRecord) {
      const subCol = $app.findCollectionByNameOrId("subscriptions");
      subRecord = new Record(subCol);
      subRecord.set("id", $security.randomString(15).toLowerCase());
      subRecord.set("merchant", merchantId);
    }

    // 3. Activate subscription with Stand Bundle (No Expiry Date)
    subRecord.set("plan", targetPlan);
    subRecord.set("status", "active");
    subRecord.set("current_period_end", "2099-12-31 23:59:59");
    subRecord.set("chipin_payment_id", `CODE_${codeRecord.getString("code")}`);
    subRecord.set("chipin_customer_email", authRecord.getString("email") || "");
    $app.save(subRecord);

    // 4. Update merchant status to active
    try {
      const merch = $app.findRecordById("merchants", merchantId);
      if (merch) {
        merch.set("status", "active");
        $app.save(merch);
      }
    } catch (mErr) {
      console.log("[REDEEM STAND CODE] Merchant update notice:", mErr.message || mErr);
    }

    // 5. Mark code as redeemed & bind branch (validating branch belongs to merchant)
    let validatedBranchId = "";
    const branchId = (body.branch_id || body.branch || "").trim();
    if (branchId) {
      try {
        const bRec = $app.findRecordById("branches", branchId);
        if (bRec && bRec.getString("merchant") === merchantId) {
          validatedBranchId = bRec.id;
        }
      } catch (bErr) {}
    }

    codeRecord.set("is_redeemed", true);
    codeRecord.set("redeemed_by", merchantId);
    if (validatedBranchId) {
      codeRecord.set("branch", validatedBranchId);
    }
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
    codeRecord.set("redeemed_at", nowStr);
    $app.save(codeRecord);

    console.log(`[REDEEM STAND CODE] Merchant ${merchantId} activated ${targetPlan} using code ${rawCode} (Branch: ${branchId || 'HQ'})`);

    return c.json(200, {
      success: true,
      message: "Physical Stand successfully activated! You have 500 customer capacity with no expiration date.",
      plan: targetPlan,
      quota: quota,
      branch_id: branchId,
      period_end: "2099-12-31 23:59:59"
    });
  } catch (err) {
    console.log("[REDEEM STAND CODE ERROR]", err.message || err);
    return c.json(500, {
      success: false,
      message: "Failed to redeem activation code: " + (err.message || err)
    });
  }
});

// Route to re-bind or assign an existing stand code to a specific branch
routerAdd("POST", "/api/risev/merchant/bind-stand-branch", (c) => {
  let authRecord = c.auth || null;
  if (!authRecord && typeof c.get === "function") {
    try {
      authRecord = c.get("authRecord");
    } catch (e) {}
  }
  if (!authRecord) {
    return c.json(401, { success: false, message: "Authentication required." });
  }

  const merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    return c.json(400, { success: false, message: "Merchant profile required." });
  }

  let body = {};
  try {
    body = c.requestInfo().body || {};
  } catch (e) {
    try {
      body = $apis.requestInfo(c).data || {};
    } catch (e2) {
      body = {};
    }
  }

  const rawCode = (body.code || body.stand_code || "").trim().toUpperCase();
  const targetBranchId = (body.branch_id || body.branch || "").trim();

  if (!rawCode) {
    return c.json(400, { success: false, message: "Stand code is required." });
  }

  try {
    const codes = $app.findRecordsByFilter(
      "activation_codes",
      `code = '${rawCode}' && redeemed_by = '${merchantId}'`,
      "-created",
      1,
      0
    );

    if (codes.length === 0) {
      return c.json(404, { success: false, message: "Stand code not found under your merchant account." });
    }

    let validatedBranchId = "";
    if (targetBranchId) {
      try {
        const bRec = $app.findRecordById("branches", targetBranchId);
        if (!bRec || bRec.getString("merchant") !== merchantId) {
          return c.json(400, { success: false, message: "Branch does not belong to your merchant account." });
        }
        validatedBranchId = bRec.id;
      } catch (bErr) {
        return c.json(400, { success: false, message: "Invalid branch ID." });
      }
    }

    const codeRec = codes[0];
    codeRec.set("branch", validatedBranchId || "");
    $app.save(codeRec);

    return c.json(200, {
      success: true,
      message: `Stand ${rawCode} successfully assigned to branch.`,
      code: rawCode,
      branch_id: targetBranchId
    });
  } catch (err) {
    return c.json(500, { success: false, message: "Failed to bind stand to branch: " + (err.message || err) });
  }
});
