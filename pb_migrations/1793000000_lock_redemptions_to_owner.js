/// <reference path="../pb_data/types.d.ts" />
// `redemptions.createRule` was `@request.auth.id != ''`, so any signed-in user could
// create a redemption for another customer and spend their points (the hook only
// compared points_cost against the balance). Lock it to the owner.
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("redemptions");
    col.createRule = "customer = @request.auth.id";
    app.save(col);
    console.log("[MIGRATION 1793000000] redemptions.createRule locked to owner");
  } catch (err) {
    console.log("[MIGRATION 1793000000] Error:", err.message || err);
  }
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("redemptions");
    col.createRule = "@request.auth.id != ''";
    app.save(col);
  } catch (e) {}
  return null;
});
