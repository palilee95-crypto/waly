// Full-page customer management endpoints.
//
//   GET  /api/risev/merchant/customer-workspace/customers?date=YYYY-MM-DD
//   GET  /api/risev/merchant/customer-workspace/customer?customer=<id>
//   POST /api/risev/merchant/customer/stamps-adjust
//   POST /api/risev/merchant/customer/points-adjust
//   GET  /api/risev/merchant/customer/vouchers?customer=<id>&status=
//   POST /api/risev/merchant/customer/vouchers/issue
//   POST /api/risev/merchant/customer/vouchers/void
//
// Read endpoints are available to merchant staff; mutations require the owner
// or a staff member with can_manage_customers. Delete remains owner-only in
// customer_management.pb.js.

routerAdd("GET", "/api/risev/merchant/customer-workspace/customers", (e) => {
  const helper = require(`${__hooks}/customer_manage_helper.js`);
  const logic = require(`${__hooks}/customer_workspace_logic.js`);

  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to manage customers." });
  const merchant = helper.resolveMerchant($app, e.auth);
  if (!merchant) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }

  const query = (e.requestInfo() && e.requestInfo().query) || {};
  const context = helper.buildManageContext($app, e.auth, merchant, query.branch);
  if (context.error) return helper.branchError(e, context.error);
  const date = String(query.date || "").trim();
  if (date) {
    const parsed = new Date(date + "T00:00:00+08:00");
    const roundTrip = isNaN(parsed.getTime()) ? "" : new Date(parsed.getTime() + 8 * 3600000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || roundTrip !== date || date > logic.localDate(0)) {
      return e.json(400, { code: "INVALID_DATE", message: "Choose a valid date up to today." });
    }
  }

  try {
    return e.json(200, logic.buildManageCustomers($app, context.ctx, {
      date: date,
      q: query.q,
      sort: query.sort,
      filter: query.filter,
      page: query.page,
      perPage: query.perPage,
    }));
  } catch (err) {
    console.log("[MANAGE CUSTOMERS] Directory failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "DIRECTORY_FAILED", message: "Could not load customers." });
  }
});

routerAdd("GET", "/api/risev/merchant/customer-workspace/customer", (e) => {
  const helper = require(`${__hooks}/customer_manage_helper.js`);
  const logic = require(`${__hooks}/customer_workspace_logic.js`);

  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to view a customer." });
  const merchant = helper.resolveMerchant($app, e.auth);
  if (!merchant) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }

  const query = (e.requestInfo() && e.requestInfo().query) || {};
  const customerId = String(query.customer || "").trim();
  if (!customerId) {
    return e.json(400, { code: "CUSTOMER_REQUIRED", message: "Customer id is required." });
  }
  if (!helper.customerBelongsToMerchant($app, merchant.id, customerId)) {
    return e.json(404, { code: "CUSTOMER_NOT_FOUND", message: "Customer not found for this store." });
  }

  const context = helper.buildManageContext($app, e.auth, merchant, query.branch);
  if (context.error) return helper.branchError(e, context.error);

  try {
    const detail = logic.buildManageCustomerDetail($app, context.ctx, customerId);
    if (!detail) {
      return e.json(404, { code: "CUSTOMER_NOT_FOUND", message: "Customer not found for this store." });
    }
    return e.json(200, detail);
  } catch (err) {
    console.log("[MANAGE CUSTOMERS] Detail failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "DETAIL_FAILED", message: "Could not load this customer." });
  }
});

routerAdd("POST", "/api/risev/merchant/customer/stamps-adjust", (e) => {
  const helper = require(`${__hooks}/customer_manage_helper.js`);

  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in first." });
  const merchant = helper.resolveMerchant($app, e.auth);
  if (!merchant) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }
  if (!helper.canManageCustomers($app, e.auth, merchant)) {
    return e.json(403, { code: "FORBIDDEN", message: "You do not have permission to manage customers." });
  }

  const body = e.requestInfo().body || {};
  const customerId = String(body.customer_id || "").trim();
  const delta = Number(body.delta);
  const reason = String(body.reason || "").trim();

  if (!customerId) return e.json(400, { code: "CUSTOMER_REQUIRED", message: "Customer id is required." });
  if (!Number.isInteger(delta) || delta === 0) {
    return e.json(400, { code: "INVALID_DELTA", message: "Stamp adjustment must be a non-zero whole number." });
  }
  if (!reason || reason.length > 300) {
    return e.json(400, { code: "REASON_REQUIRED", message: "A reason is required." });
  }
  if (!helper.customerBelongsToMerchant($app, merchant.id, customerId)) {
    return e.json(404, { code: "CUSTOMER_NOT_FOUND", message: "Customer not found for this store." });
  }

  const cards = $app.findRecordsByFilter(
    "loyalty_cards",
    `merchant = "${merchant.id}" && customer = "${customerId}"`,
    "-created",
    1,
    0
  );
  if (!cards.length) {
    return e.json(404, { code: "CARD_NOT_FOUND", message: "This customer has no loyalty card." });
  }

  const card = cards[0];
  let program = null;
  try {
    program = $app.findRecordById("loyalty_programs", card.getString("program"));
  } catch (err) {}

  if (program && program.getBool("enable_stamps") === false) {
    return e.json(400, { code: "STAMPS_DISABLED", message: "Stamps are disabled for this loyalty program." });
  }

  const previous = Number(card.get("stamps_collected")) || 0;
  const next = previous + delta;
  if (next < 0) {
    return e.json(400, { code: "INVALID_BALANCE", message: "Stamps cannot go below zero." });
  }
  const previousCompletions = Number(card.get("completions")) || 0;
  const goal = program ? Number(program.get("stamp_goal")) || 10 : 10;
  let result = { stamps: previous, completions: previousCompletions };

  try {
    $app.runInTransaction((app) => {
      card.set("stamps_collected", next);
      app.save(card);

      const tx = new Record(app.findCollectionByNameOrId("transactions"));
      tx.set("id", $security.randomString(15).toLowerCase());
      tx.set("customer", customerId);
      tx.set("merchant", merchant.id);
      tx.set("loyalty_card", card.id);
      tx.set("type", "adjust");
      tx.set("stamps", delta > 0 ? delta : 0);
      tx.set("points", 0);
      tx.set("bill_amount", 0);
      tx.set("metadata", JSON.stringify({
        reason: reason,
        previous: previous,
        next: next,
        stamp_delta: delta,
        staff_id: e.auth.id,
        source: "manage_customers",
      }));
      try { tx.set("staff", e.auth.id); } catch (err) {}
      app.save(tx);

      const updated = app.findRecordById("loyalty_cards", card.id);
      result = {
        stamps: Number(updated.get("stamps_collected")) || 0,
        completions: Number(updated.get("completions")) || 0,
      };
    });
  } catch (err) {
    console.log("[MANAGE CUSTOMERS] Stamp adjustment failed:", err && err.message ? err.message : err);
    return e.json(400, { code: "STAMP_ADJUST_FAILED", message: String(err.message || err) });
  }

  return e.json(200, {
    success: true,
    stamps: result.stamps,
    goal: goal,
    completions: result.completions,
    rewardUnlocked: result.completions > previousCompletions,
  });
});

routerAdd("POST", "/api/risev/merchant/customer/points-adjust", (e) => {
  const helper = require(`${__hooks}/customer_manage_helper.js`);
  const pointsEngine = require(`${__hooks}/points_engine.js`);

  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in first." });
  const merchant = helper.resolveMerchant($app, e.auth);
  if (!merchant) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }
  if (!helper.canManageCustomers($app, e.auth, merchant)) {
    return e.json(403, { code: "FORBIDDEN", message: "You do not have permission to manage customers." });
  }

  const body = e.requestInfo().body || {};
  const customerId = String(body.customer_id || "").trim();
  const delta = Number(body.delta);
  const reason = String(body.reason || "").trim();

  if (!customerId) return e.json(400, { code: "CUSTOMER_REQUIRED", message: "Customer id is required." });
  if (!Number.isInteger(delta) || delta === 0) {
    return e.json(400, { code: "INVALID_DELTA", message: "Point adjustment must be a non-zero whole number." });
  }
  if (!reason || reason.length > 300) {
    return e.json(400, { code: "REASON_REQUIRED", message: "A reason is required." });
  }
  if (!helper.customerBelongsToMerchant($app, merchant.id, customerId)) {
    return e.json(404, { code: "CUSTOMER_NOT_FOUND", message: "Customer not found for this store." });
  }

  const cards = $app.findRecordsByFilter(
    "loyalty_cards",
    `merchant = "${merchant.id}" && customer = "${customerId}"`,
    "-created",
    1,
    0
  );
  if (!cards.length) {
    return e.json(404, { code: "CARD_NOT_FOUND", message: "This customer has no loyalty card." });
  }

  const card = cards[0];
  let program = null;
  try {
    program = $app.findRecordById("loyalty_programs", card.getString("program"));
  } catch (err) {}

  if (program && program.getBool("enable_points") === false) {
    return e.json(400, { code: "POINTS_DISABLED", message: "Points are disabled for this loyalty program." });
  }

  const previous = Number(card.get("points_balance")) || 0;
  const next = previous + delta;
  if (next < 0) {
    return e.json(400, { code: "INVALID_BALANCE", message: "Points cannot go below zero." });
  }
  let result = previous;

  try {
    $app.runInTransaction((app) => {
      card.set("points_balance", next);
      app.save(card);

      const tx = new Record(app.findCollectionByNameOrId("transactions"));
      tx.set("id", $security.randomString(15).toLowerCase());
      tx.set("customer", customerId);
      tx.set("merchant", merchant.id);
      tx.set("loyalty_card", card.id);
      tx.set("type", "adjust");
      tx.set("stamps", 0);
      tx.set("points", delta);
      tx.set("bill_amount", 0);
      tx.set("metadata", JSON.stringify({
        reason: reason,
        previous: previous,
        next: next,
        staff_id: e.auth.id,
        source: "manage_customers",
      }));
      try { tx.set("staff", e.auth.id); } catch (err) {}
      app.save(tx);

      const updated = app.findRecordById("loyalty_cards", card.id);
      result = Number(updated.get("points_balance")) || 0;
    });
  } catch (err) {
    console.log("[MANAGE CUSTOMERS] Point adjustment failed:", err && err.message ? err.message : err);
    return e.json(400, { code: "POINT_ADJUST_FAILED", message: String(err.message || err) });
  }

  try {
    pointsEngine.recomputeTotalPoints(customerId);
  } catch (err) {
    console.log("[MANAGE CUSTOMERS] total_points refresh failed:", err && err.message ? err.message : err);
  }

  return e.json(200, { success: true, points: result });
});

routerAdd("GET", "/api/risev/merchant/customer/vouchers", (e) => {
  const helper = require(`${__hooks}/customer_manage_helper.js`);

  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in first." });
  const merchant = helper.resolveMerchant($app, e.auth);
  if (!merchant) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }

  const query = (e.requestInfo() && e.requestInfo().query) || {};
  const customerId = String(query.customer || "").trim();
  const status = String(query.status || "").trim();
  if (!customerId) return e.json(400, { code: "CUSTOMER_REQUIRED", message: "Customer id is required." });
  if (!helper.customerBelongsToMerchant($app, merchant.id, customerId)) {
    return e.json(404, { code: "CUSTOMER_NOT_FOUND", message: "Customer not found for this store." });
  }

  let filter = `customer = "${customerId}" && reward.merchant = "${merchant.id}"`;
  if (["active", "used", "expired", "voided"].indexOf(status) >= 0) {
    filter += ` && status = "${status}"`;
  }

  try {
    const records = $app.findRecordsByFilter("vouchers", filter, "-created", 200, 0);
    const items = records.map(function (voucher) {
      let rewardName = "Reward";
      try {
        const reward = $app.findRecordById("rewards", voucher.getString("reward"));
        rewardName = reward.getString("name") || reward.getString("title") || rewardName;
      } catch (err) {}
      return {
        id: voucher.id,
        code: voucher.getString("code"),
        status: voucher.getString("status"),
        rewardName: rewardName,
        expiresAt: voucher.getString("expires_at") || null,
        createdAt: voucher.getString("created"),
      };
    });
    return e.json(200, { items: items });
  } catch (err) {
    console.log("[MANAGE CUSTOMERS] Voucher list failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "VOUCHERS_FAILED", message: "Could not load vouchers." });
  }
});

routerAdd("POST", "/api/risev/merchant/customer/vouchers/issue", (e) => {
  const helper = require(`${__hooks}/customer_manage_helper.js`);

  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in first." });
  const merchant = helper.resolveMerchant($app, e.auth);
  if (!merchant) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }
  if (!helper.canManageCustomers($app, e.auth, merchant)) {
    return e.json(403, { code: "FORBIDDEN", message: "You do not have permission to manage customers." });
  }

  const body = e.requestInfo().body || {};
  const customerId = String(body.customer_id || "").trim();
  const rewardId = String(body.reward_id || "").trim();
  const note = String(body.note || "").trim();
  if (!customerId || !rewardId) {
    return e.json(400, { code: "INVALID_INPUT", message: "Customer and reward are required." });
  }
  if (!helper.customerBelongsToMerchant($app, merchant.id, customerId)) {
    return e.json(404, { code: "CUSTOMER_NOT_FOUND", message: "Customer not found for this store." });
  }

  let reward = null;
  try {
    reward = $app.findRecordById("rewards", rewardId);
  } catch (err) {
    return e.json(404, { code: "REWARD_NOT_FOUND", message: "Reward not found." });
  }
  if (reward.getString("merchant") !== merchant.id) {
    return e.json(403, { code: "REWARD_FORBIDDEN", message: "That reward belongs to another store." });
  }
  if (reward.getBool("is_active") === false) {
    return e.json(400, { code: "REWARD_INACTIVE", message: "That reward is not active." });
  }

  let expiresAt = "";
  if (body.expires_at) {
    const parsed = new Date(body.expires_at);
    if (!isNaN(parsed.getTime())) expiresAt = parsed.toISOString();
  }
  if (!expiresAt) expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

  try {
    const voucher = new Record($app.findCollectionByNameOrId("vouchers"));
    voucher.set("id", $security.randomString(15).toLowerCase());
    voucher.set("customer", customerId);
    voucher.set("reward", rewardId);
    voucher.set("code", helper.generateVoucherCode());
    voucher.set("status", "active");
    voucher.set("expires_at", expiresAt);
    voucher.set("metadata", JSON.stringify({
      merchant_id: merchant.id,
      reward_id: rewardId,
      source: "manage_customers",
      note: note,
    }));
    try {
      const branch = e.auth.getString("branch") || "";
      if (branch) voucher.set("branch", branch);
    } catch (err) {}
    $app.save(voucher);

    return e.json(200, {
      success: true,
      voucher: {
        id: voucher.id,
        code: voucher.getString("code"),
        status: voucher.getString("status"),
        rewardName: reward.getString("name") || reward.getString("title") || "Reward",
        expiresAt: voucher.getString("expires_at"),
        createdAt: voucher.getString("created"),
      },
    });
  } catch (err) {
    console.log("[MANAGE CUSTOMERS] Voucher issue failed:", err && err.message ? err.message : err);
    return e.json(400, { code: "VOUCHER_ISSUE_FAILED", message: String(err.message || err) });
  }
});

routerAdd("POST", "/api/risev/merchant/customer/vouchers/void", (e) => {
  const helper = require(`${__hooks}/customer_manage_helper.js`);

  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in first." });
  const merchant = helper.resolveMerchant($app, e.auth);
  if (!merchant) {
    return e.json(403, { code: "MERCHANT_REQUIRED", message: "No merchant profile is linked to this account." });
  }
  if (!helper.canManageCustomers($app, e.auth, merchant)) {
    return e.json(403, { code: "FORBIDDEN", message: "You do not have permission to manage customers." });
  }

  const body = e.requestInfo().body || {};
  const voucherId = String(body.voucher_id || "").trim();
  const reason = String(body.reason || "").trim();
  if (!voucherId) return e.json(400, { code: "VOUCHER_REQUIRED", message: "Voucher id is required." });
  if (!reason || reason.length > 300) {
    return e.json(400, { code: "REASON_REQUIRED", message: "A reason is required." });
  }

  let voucher = null;
  try {
    voucher = $app.findRecordById("vouchers", voucherId);
  } catch (err) {
    return e.json(404, { code: "VOUCHER_NOT_FOUND", message: "Voucher not found." });
  }

  let reward = null;
  try {
    reward = $app.findRecordById("rewards", voucher.getString("reward"));
  } catch (err) {}
  if (!reward || reward.getString("merchant") !== merchant.id) {
    return e.json(403, { code: "VOUCHER_FORBIDDEN", message: "That voucher belongs to another store." });
  }

  const status = voucher.getString("status");
  if (status === "used" || status === "voided") {
    return e.json(400, { code: "VOUCHER_NOT_VOIDABLE", message: `This voucher is already ${status}.` });
  }

  try {
    let metadata = {};
    try {
      const raw = voucher.getString("metadata");
      metadata = raw && raw !== "null" ? JSON.parse(raw) : {};
    } catch (err) {
      metadata = {};
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) metadata = {};
    metadata.void_reason = reason;
    metadata.voided_by = e.auth.id;
    metadata.voided_at = new Date().toISOString();

    voucher.set("status", "voided");
    voucher.set("metadata", JSON.stringify(metadata));
    $app.save(voucher);

    return e.json(200, {
      success: true,
      voucher: {
        id: voucher.id,
        code: voucher.getString("code"),
        status: voucher.getString("status"),
        rewardName: reward.getString("name") || reward.getString("title") || "Reward",
        expiresAt: voucher.getString("expires_at") || null,
        createdAt: voucher.getString("created"),
      },
    });
  } catch (err) {
    console.log("[MANAGE CUSTOMERS] Voucher void failed:", err && err.message ? err.message : err);
    return e.json(400, { code: "VOUCHER_VOID_FAILED", message: String(err.message || err) });
  }
});
