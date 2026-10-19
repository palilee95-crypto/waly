/// <reference path="../pb_data/types.d.ts" />
// `store_feedbacks.createRule` was "" (public), so anyone could POST fabricated
// reviews straight to the collection API — bypassing every check the app makes.
//
// Lock creation to superusers. All legitimate writes now go through
// POST /api/risev/feedback/submit (pb_hooks/public_feedback.pb.js), which
// validates the merchant/rating/phone, dedupes per phone per day, and saves with
// $app.save (server-side, unaffected by this rule).
//
// listRule / viewRule / updateRule / deleteRule stay merchant-owner only.
// The staff-rating sync inside booking_system.pb.js also uses $app.save, so it
// is unaffected.

migrate((app) => {
  try {
    const feedbackCol = app.findCollectionByNameOrId("store_feedbacks");
    if (!feedbackCol) {
      console.log("[MIGRATION 1782807091] store_feedbacks not found, skipping");
      return;
    }
    feedbackCol.createRule = null;
    app.save(feedbackCol);
    console.log("[MIGRATION 1782807091] store_feedbacks.createRule locked to superusers — use POST /api/risev/feedback/submit");
  } catch (err) {
    console.log("[MIGRATION 1782807091] Error locking createRule:", err.message || err);
  }
}, (app) => {
  try {
    const feedbackCol = app.findCollectionByNameOrId("store_feedbacks");
    if (feedbackCol) {
      feedbackCol.createRule = "";
      app.save(feedbackCol);
    }
  } catch (err) {}
});
