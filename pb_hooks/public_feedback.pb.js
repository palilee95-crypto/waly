// pb_hooks/public_feedback.pb.js
//
// Public store-feedback submission.
//
// `store_feedbacks.createRule` is superuser-only (migration 1782807091), so the
// two customer surfaces — the public booking PWA (`app/b/[slug].tsx`) and the
// NFC claim screen (`app/nfc.tsx`) — post here instead of writing to the
// collection directly. That closed the hole where anyone could POST fabricated
// reviews straight to the API.
//
// This handler validates, dedupes one review per phone per merchant per day,
// and saves with $app.save (which bypasses collection rules by design).

routerAdd("POST", "/api/risev/feedback/submit", (e) => {
  let body = {};
  try {
    body = e.requestInfo().body || {};
  } catch (bErr) {
    try {
      body = $apis.requestInfo(e).body || {};
    } catch (bErr2) {
      body = {};
    }
  }

  const merchantId = (body.merchant || body.merchant_id || "").trim();
  const rating = parseInt(body.rating, 10) || 0;
  const rawPhone = (body.customer_phone || body.phone || "").trim();
  const phoneDigits = rawPhone.replace(/[^\d]/g, "");
  const customerName = (body.customer_name || body.name || "").trim().slice(0, 120);
  const feedback = (body.feedback || body.review || "").trim().slice(0, 1000);
  const redirectedToGoogle = body.redirected_to_google === true;

  if (!merchantId) {
    return e.json(400, { message: "merchant is required" });
  }
  if (rating < 1 || rating > 5) {
    return e.json(400, { message: "rating must be an integer between 1 and 5" });
  }
  // Without a phone there is nothing to attribute or throttle a review by.
  if (phoneDigits.length < 8) {
    return e.json(400, { message: "A valid customer_phone is required" });
  }

  let merchant = null;
  try {
    merchant = $app.findRecordById("merchants", merchantId);
  } catch (mErr) {}
  if (!merchant) {
    return e.json(404, { message: "Merchant not found" });
  }
  if (merchant.getString("status") === "suspended") {
    return e.json(403, { message: "This store is not accepting feedback." });
  }

  // One review per phone per merchant per 24h. Stops this public route from
  // being used to spam ratings without blocking genuine later visits.
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .substring(0, 19);
  try {
    const recent = $app.findRecordsByFilter(
      "store_feedbacks",
      `merchant = "${merchantId}" && created >= "${sinceIso}"`,
      "-created",
      200,
      0
    );
    for (let i = 0; i < recent.length; i++) {
      const existingDigits = (recent[i].getString("customer_phone") || "").replace(/[^\d]/g, "");
      if (existingDigits && existingDigits === phoneDigits) {
        return e.json(200, { success: true, duplicate: true });
      }
    }
  } catch (dupErr) {
    console.log("[PUBLIC FEEDBACK] dedupe scan failed:", dupErr.message || dupErr);
  }

  try {
    const fbCol = $app.findCollectionByNameOrId("store_feedbacks");
    const rec = new Record(fbCol);
    rec.set("id", $security.randomString(15).toLowerCase());
    rec.set("merchant", merchantId);
    rec.set("customer_phone", rawPhone);
    rec.set("customer_name", customerName);
    rec.set("rating", rating);
    rec.set("feedback", feedback);
    rec.set("redirected_to_google", redirectedToGoogle);
    $app.save(rec);

    return e.json(200, { success: true, id: rec.id, duplicate: false });
  } catch (saveErr) {
    console.log("[PUBLIC FEEDBACK] save error:", saveErr.message || saveErr);
    return e.json(500, { message: "Failed to save feedback" });
  }
});
