/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const progCol = app.findCollectionByNameOrId("pbc_programs00") || app.findCollectionByNameOrId("loyalty_programs");
    const rewardsCol = app.findCollectionByNameOrId("pbc_rewards000") || app.findCollectionByNameOrId("rewards");
    if (!progCol || !rewardsCol) return null;

    const programs = app.findRecordsByFilter(progCol.name || "loyalty_programs", "1=1", "created", 1000, 0);
    programs.forEach((prog) => {
      const linkedRewardId = prog.get("linked_reward");
      const merchantId = prog.get("merchant");
      const rewardDesc = prog.get("reward_description") || prog.get("name") || "Stamp Completion Reward";

      let validLinked = false;
      if (linkedRewardId) {
        try {
          const existingRw = app.findRecordById(rewardsCol.name || "rewards", linkedRewardId);
          if (existingRw) validLinked = true;
        } catch (e) {}
      }

      if (!validLinked && merchantId) {
        try {
          // Check if a reward with matching name already exists for this merchant
          const matchingRewards = app.findRecordsByFilter(
            rewardsCol.name || "rewards",
            `merchant = "${merchantId}" && name = "${rewardDesc}"`,
            "-created",
            1,
            0
          );

          if (matchingRewards.length > 0) {
            prog.set("linked_reward", matchingRewards[0].id);
            app.save(prog);
            console.log(`[MIGRATION 1782807063] Linked existing reward ${matchingRewards[0].id} to program ${prog.id}`);
          } else {
            // Create a new reward
            const reward = new Record(rewardsCol);
            reward.set("merchant", merchantId);
            reward.set("name", rewardDesc);
            reward.set("description", `Reward for completing ${prog.get("name") || "Stamp Card"}`);
            reward.set("points_cost", 0);
            reward.set("stock", 1000000);
            reward.set("is_active", true);
            reward.set("type", "free_item");

            app.save(reward);

            prog.set("linked_reward", reward.id);
            app.save(prog);
            console.log(`[MIGRATION 1782807063] Created & linked new reward ${reward.id} to program ${prog.id}`);
          }
        } catch (rErr) {
          console.log(`[MIGRATION 1782807063] Error creating/linking reward for program ${prog.id}:`, rErr.message || rErr);
        }
      }
    });
  } catch (err) {
    console.log("[MIGRATION 1782807063] Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
