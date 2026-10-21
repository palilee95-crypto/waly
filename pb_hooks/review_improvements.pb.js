// Merchant improvement tasks linked to immutable customer feedback.
// All task mutations are owner-checked; the underlying collection is not
// writable through PocketBase's ordinary record API.

routerAdd("GET", "/api/risev/merchant/review-improvements", (e) => {
  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to view improvement tasks." });
  const logic = require(`${__hooks}/review_improvements_logic.js`);
  const merchant = logic.ownerMerchant($app, e.auth);
  if (!merchant) return e.json(403, { code: "MERCHANT_OWNER_REQUIRED", message: "Only the merchant owner can manage improvements." });
  try { return e.json(200, logic.listTasks($app, merchant.id)); }
  catch (err) {
    console.log("[REVIEW IMPROVEMENTS] List failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "TASKS_FAILED", message: "Could not load improvement tasks." });
  }
});

routerAdd("POST", "/api/risev/merchant/review-improvements", (e) => {
  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to create an improvement task." });
  const logic = require(`${__hooks}/review_improvements_logic.js`);
  const merchant = logic.ownerMerchant($app, e.auth);
  if (!merchant) return e.json(403, { code: "MERCHANT_OWNER_REQUIRED", message: "Only the merchant owner can manage improvements." });
  const body = (e.requestInfo() && e.requestInfo().body) || {};
  try {
    const result = logic.createTask($app, merchant.id, body);
    if (result.error) return e.json(result.notFound ? 404 : 400, { code: "INVALID_TASK", message: result.error });
    return e.json(201, result);
  } catch (err) {
    console.log("[REVIEW IMPROVEMENTS] Create failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "TASK_CREATE_FAILED", message: "Could not create improvement task." });
  }
});

routerAdd("POST", "/api/risev/merchant/review-improvements/status", (e) => {
  if (!e.auth) return e.json(401, { code: "AUTH_REQUIRED", message: "Sign in to update an improvement task." });
  const logic = require(`${__hooks}/review_improvements_logic.js`);
  const merchant = logic.ownerMerchant($app, e.auth);
  if (!merchant) return e.json(403, { code: "MERCHANT_OWNER_REQUIRED", message: "Only the merchant owner can manage improvements." });
  const body = (e.requestInfo() && e.requestInfo().body) || {};
  try {
    const result = logic.updateStatus($app, merchant.id, body);
    if (result.error) return e.json(result.notFound ? 404 : 400, { code: "INVALID_TASK", message: result.error });
    return e.json(200, result);
  } catch (err) {
    console.log("[REVIEW IMPROVEMENTS] Status failed:", err && err.message ? err.message : err);
    return e.json(500, { code: "TASK_UPDATE_FAILED", message: "Could not update improvement task." });
  }
});
