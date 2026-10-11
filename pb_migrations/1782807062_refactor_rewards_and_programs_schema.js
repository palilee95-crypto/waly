/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // 1. Update rewards collection schema
    const rewardsCol = app.findCollectionByNameOrId("pbc_rewards000") || app.findCollectionByNameOrId("rewards");
    if (rewardsCol) {
      try {
        const pointsCostField = rewardsCol.fields.getByName("points_cost");
        if (pointsCostField) {
          pointsCostField.required = false;
        }
      } catch (e) {}

      try {
        rewardsCol.fields.add(new Field({
          "id": "bool_is_archived_rw",
          "name": "is_archived",
          "type": "bool",
          "required": false
        }));
      } catch (e) {}

      app.save(rewardsCol);
    }

    // 2. Update loyalty_programs collection schema
    const progCol = app.findCollectionByNameOrId("pbc_programs00") || app.findCollectionByNameOrId("loyalty_programs");
    if (progCol) {
      try {
        const rewardDescField = progCol.fields.getByName("reward_description");
        if (rewardDescField) {
          rewardDescField.required = false;
        }
      } catch (e) {}

      app.save(progCol);
    }
  } catch (err) {
    console.log("[MIGRATION 1782807062] Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
