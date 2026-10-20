// Customer Workspace — read-only metrics for the merchant Customers tab.
//
//   GET /api/risev/merchant/customer-workspace?branch=<id|all>&from=YYYY-MM-DD&to=YYYY-MM-DD
//   GET /api/risev/merchant/customer-workspace/audience?card=return|rewards|birthday&page=1&perPage=20
//
// Read-only: no writes, no messaging. JSVM rules honoured here:
//   * every helper lives INSIDE the handler (file-level functions are not visible);
//   * the metric logic itself comes from a require()d module, which is evaluated normally;
//   * ids are always bound, never string-interpolated into SQL;
//   * errors branch on status/instance, never on err.name (always undefined here).

// NOTE: no file-level values may be referenced inside a handler — JSVM handlers are
// re-evaluated without file scope, so a module-level const throws ReferenceError.
// Anything shared must live inside the handler or in a require()d module.
routerAdd("GET", "/api/risev/merchant/customer-workspace", (e) => {
  const logic = require(`${__hooks}/customer_workspace_logic.js`);

  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to view customer metrics." });
  }

  // ── Resolve the merchant from the session, never from the request ──
  let merchantId = "";
  try {
    merchantId = authRecord.getString("merchant_id") || "";
  } catch (err) {}
  if (!merchantId) {
    try {
      const owned = $app.findRecordsByFilter("merchants", "owner = '" + authRecord.id + "'", "", 1, 0);
      if (owned && owned.length > 0) merchantId = owned[0].id;
    } catch (err) {}
  }
  if (!merchantId) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }

  let merchant = null;
  try {
    merchant = $app.findRecordById("merchants", merchantId);
  } catch (err) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "Merchant profile not found." });
  }

  // ── Branch scope ──
  const query = (e.requestInfo() && e.requestInfo().query) || {};
  const requestedBranch = String(query.branch || "all");

  let branches = [];
  try {
    branches = $app.findRecordsByFilter("branches", "merchant = '" + merchantId + "'", "-is_hq,-created", 100, 0);
  } catch (err) {}

  // Staff are bound to their own outlet; the owner is brand-wide.
  let staffBranch = "";
  try {
    staffBranch = authRecord.getString("branch") || "";
  } catch (err) {}

  let branchId = requestedBranch === "all" ? "" : requestedBranch;
  if (staffBranch) {
    if (branchId && branchId !== staffBranch) {
      return e.json(403, { code: "BRANCH_FORBIDDEN", message: "You can only view your own outlet." });
    }
    branchId = staffBranch;
  }

  let isHqBranch = false;
  if (branchId) {
    let found = null;
    for (let i = 0; i < branches.length; i++) {
      if (branches[i].id === branchId) found = branches[i];
    }
    if (!found) {
      return e.json(400, { code: "INVALID_BRANCH", message: "That outlet does not belong to this merchant." });
    }
    isHqBranch = !!found.getBool("is_hq");
  }

  // ── Period: local (UTC+8) calendar range, defaulting to the current month ──
  const today = logic.localDate(0);
  const monthStart = today.slice(0, 8) + "01";
  const nextMonthStart = (function () {
    const y = Number(today.slice(0, 4));
    const m = Number(today.slice(5, 7));
    return m === 12 ? String(y + 1) + "-01-01" : String(y) + "-" + (m + 1 < 10 ? "0" + (m + 1) : m + 1) + "-01";
  })();

  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(String(query.from || "")) ? String(query.from) : monthStart;
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(String(query.to || "")) ? String(query.to) : nextMonthStart;
  if (toDate <= fromDate) {
    return e.json(400, { code: "INVALID_PERIOD", message: "The period end must be after its start." });
  }

  // Reports are available on every plan — no entitlement gate.
  const ctx = {
    merchantId: merchantId,
    branchId: branchId,
    isHqBranch: isHqBranch,
    fromDate: fromDate,
    toDate: toDate,
    fromUtc: logic.localDateToUtcStart(fromDate),
    toUtc: logic.localDateToUtcStart(toDate),
    returnDays: Number(merchant.getInt ? merchant.getInt("inactive_threshold_days") : 0) || 30,
  };

  try {
    const snapshot = logic.buildSnapshot($app, ctx);
    return e.json(200, Object.assign(
      {
        asOf: new Date().toISOString(),
        timeZone: "Asia/Kuala_Lumpur",
        merchant: {
          id: merchant.id,
          name: merchant.getString("name"),
          logo: merchant.getString("logo") || "",
        },
        branches: branches.map(function (b) {
          return { id: b.id, name: b.getString("name"), isHq: b.getBool("is_hq") };
        }),
        scope: { branchId: branchId || "all", from: fromDate, to: toDate },
      },
      snapshot
    ));
  } catch (err) {
    console.log("[CUSTOMER WORKSPACE] Snapshot failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "WORKSPACE_FAILED", message: "Could not build the customer snapshot." });
  }
});

routerAdd("GET", "/api/risev/merchant/customer-workspace/audience", (e) => {
  const logic = require(`${__hooks}/customer_workspace_logic.js`);

  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to view an audience." });
  }

  let merchantId = "";
  try {
    merchantId = authRecord.getString("merchant_id") || "";
  } catch (err) {}
  if (!merchantId) {
    try {
      const owned = $app.findRecordsByFilter("merchants", "owner = '" + authRecord.id + "'", "", 1, 0);
      if (owned && owned.length > 0) merchantId = owned[0].id;
    } catch (err) {}
  }
  if (!merchantId) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }

  let merchant = null;
  try {
    merchant = $app.findRecordById("merchants", merchantId);
  } catch (err) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "Merchant profile not found." });
  }

  const query = (e.requestInfo() && e.requestInfo().query) || {};
  const card = String(query.card || "");
  if (["return", "rewards", "rebook", "birthday", "all"].indexOf(card) === -1) {
    return e.json(400, { code: "INVALID_CARD", message: "Unknown audience card." });
  }

  const requestedBranch = String(query.branch || "all");
  let staffBranch = "";
  try {
    staffBranch = authRecord.getString("branch") || "";
  } catch (err) {}
  let branchId = requestedBranch === "all" ? "" : requestedBranch;
  if (staffBranch) {
    if (branchId && branchId !== staffBranch) {
      return e.json(403, { code: "BRANCH_FORBIDDEN", message: "You can only view your own outlet." });
    }
    branchId = staffBranch;
  }

  let isHqBranch = false;
  if (branchId) {
    try {
      const b = $app.findRecordById("branches", branchId);
      if (b.getString("merchant") !== merchantId) {
        return e.json(400, { code: "INVALID_BRANCH", message: "That outlet does not belong to this merchant." });
      }
      isHqBranch = !!b.getBool("is_hq");
    } catch (err) {
      return e.json(400, { code: "INVALID_BRANCH", message: "That outlet does not belong to this merchant." });
    }
  }

  try {
    const result = logic.buildAudience($app, {
      merchantId: merchantId,
      branchId: branchId,
      isHqBranch: isHqBranch,
      returnDays: Number(merchant.getInt ? merchant.getInt("inactive_threshold_days") : 0) || 30,
    }, card, query.page, query.perPage);

    return e.json(200, {
      card: card,
      page: Math.max(1, Number(query.page) || 1),
      items: result.items,
    });
  } catch (err) {
    console.log("[CUSTOMER WORKSPACE] Audience failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "AUDIENCE_FAILED", message: "Could not load that audience." });
  }
});
