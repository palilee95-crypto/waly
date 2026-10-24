/// <reference path="../pb_data/types.d.ts" />
// Catalogue rewards were repeatable with no per-customer cap: a customer could
// spend points on the same reward until the shop-wide stock ran out. Merchants
// asked for a "once per customer" option (and N-per-customer), so store the cap
// here. 0 / unset means unlimited, which keeps every existing reward unchanged.
migrate((app) => {
  try {
    const rewards = app.findCollectionByNameOrId("rewards");
    let exists = false;
    try { exists = !!rewards.fields.getByName("max_per_customer"); } catch (err) { exists = false; }
    if (!exists) {
      rewards.fields.add(new Field({
        id: "num_reward_max_per_customer",
        name: "max_per_customer",
        type: "number",
        required: false,
        system: false,
        min: 0,
        max: null,
        onlyInt: true,
      }));
      app.save(rewards);
      console.log("[MIGRATION 1793000014] Added rewards.max_per_customer");
    }
  } catch (err) {
    console.log("[MIGRATION 1793000014 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const rewards = app.findCollectionByNameOrId("rewards");
    try { rewards.fields.removeByName("max_per_customer"); } catch (err) {}
    app.save(rewards);
  } catch (err) {
    console.log("[MIGRATION 1793000014 DOWN ERROR]", err.message || err);
  }
});
