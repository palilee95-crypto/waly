/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const dead = [
    "badges",
    "user_badges",
    "streaks",
    "challenges",
    "user_challenges",
    "notifications",
    "push_tokens",
    "tier_history"
  ];
  for (const name of dead) {
    try {
      const col = app.findCollectionByNameOrId(name);
      app.delete(col);
      console.log("Deleted collection: " + name);
    } catch (e) {
      console.log("Skip " + name + ": " + (e.message || e));
    }
  }
  return null;
}, (app) => {
  return null;
})