/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const rewardsCol = app.findCollectionByNameOrId("pbc_rewards000") || app.findCollectionByNameOrId("rewards");
    if (rewardsCol) {
      try {
        rewardsCol.fields.add(new Field({
          "id": "txt_rw_visual_id",
          "name": "reward_visual_id",
          "type": "text",
          "required": false
        }));
      } catch (e) {}

      app.save(rewardsCol);
      console.log("[MIGRATION 1782807070] Successfully added reward_visual_id field to rewards schema");
    }
  } catch (err) {
    console.log("[MIGRATION 1782807070] Error adding reward_visual_id field:", err.message || err);
  }
}, (app) => {
  try {
    const rewardsCol = app.findCollectionByNameOrId("pbc_rewards000") || app.findCollectionByNameOrId("rewards");
    if (rewardsCol) {
      try {
        rewardsCol.fields.removeById("txt_rw_visual_id");
        app.save(rewardsCol);
      } catch (e) {}
    }
  } catch (err) {}
});
