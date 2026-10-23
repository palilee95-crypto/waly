/// <reference path="../pb_data/types.d.ts" />
// `rewards` holds four different things in one table:
//   1. points-catalogue items the merchant creates,
//   2. the stamp card's completion prize (`loyalty_programs.linked_reward`),
//   3. milestone shadow records used to back sub-reward vouchers,
//   4. internal voucher backing ("Points Cash Voucher" for points -> cash).
//
// Until now the only way to tell them apart was an implicit
// `reward.id == linked_reward` comparison plus a reused `is_archived` flag, so the
// merchant catalogue listed system records as if the merchant owned them and let
// them be edited (prod: the cash voucher was saved and lost `type: cash_credit`).
//
// `reward_scope` makes the distinction explicit. The merchant catalogue shows
// `catalog` rows only; the stamp prize and the points cash-out row are rendered
// from the program, never from the list.
migrate((app) => {
  try {
    const rewards = app.findCollectionByNameOrId("rewards");

    if (!rewards.fields.getByName("reward_scope")) {
      rewards.fields.add(new Field({
        "id": "sel_reward_scope",
        "name": "reward_scope",
        "type": "select",
        "required": false,
        "maxSelect": 1,
        "values": ["catalog", "stamp_goal", "milestone", "system"],
      }));
      // Fields first, backfill second — and never a field plus an index in one save.
      app.save(rewards);
      console.log("[MIGRATION 1793000011] Added rewards.reward_scope");
    }

    const db = app.db();

    // 4. Internal voucher backing. "Points Cash Voucher" is created by
    // pb_hooks/points_cash.pb.js; campaign/birthday fallbacks only exist when a
    // merchant has no catalogue at all, so they are never merchant content.
    db.newQuery(
      "UPDATE rewards SET reward_scope = 'system' " +
      "WHERE (reward_scope IS NULL OR reward_scope = '') AND (" +
      "  name = 'Points Cash Voucher' OR name = 'Campaign Reward' OR name = 'Birthday Reward' " +
      "  OR description LIKE 'Birthday reward from %'" +
      ")"
    ).execute();

    // 2. The stamp card prize wins over everything else it might look like.
    db.newQuery(
      "UPDATE rewards SET reward_scope = 'stamp_goal' " +
      "WHERE (reward_scope IS NULL OR reward_scope = '') AND id IN (" +
      "  SELECT linked_reward FROM loyalty_programs WHERE linked_reward != ''" +
      ")"
    ).execute();

    // 3. Milestone shadow rewards, referenced by loyalty_programs.sub_rewards JSON.
    try {
      db.newQuery(
        "UPDATE rewards SET reward_scope = 'milestone' " +
        "WHERE (reward_scope IS NULL OR reward_scope = '') AND id IN (" +
        "  SELECT json_extract(sr.value, '$.linked_reward') " +
        "  FROM loyalty_programs lp, json_each(CASE WHEN json_valid(lp.sub_rewards) THEN lp.sub_rewards ELSE '[]' END) sr " +
        "  WHERE json_extract(sr.value, '$.linked_reward') IS NOT NULL " +
        "    AND json_extract(sr.value, '$.linked_reward') != ''" +
        ")"
      ).execute();
    } catch (err) {
      console.log("[MIGRATION 1793000011] sub_rewards scan skipped:", err.message || err);
    }

    db.newQuery(
      "UPDATE rewards SET reward_scope = 'milestone' " +
      "WHERE (reward_scope IS NULL OR reward_scope = '') AND description = 'Milestone Reward'"
    ).execute();

    // 1. Everything left is a merchant catalogue reward.
    db.newQuery(
      "UPDATE rewards SET reward_scope = 'catalog' " +
      "WHERE reward_scope IS NULL OR reward_scope = ''"
    ).execute();

    const counts = new DynamicModel({ catalog: 0, stamp_goal: 0, milestone: 0, system: 0 });
    db.newQuery(
      "SELECT " +
      "  SUM(CASE WHEN reward_scope = 'catalog' THEN 1 ELSE 0 END) AS catalog, " +
      "  SUM(CASE WHEN reward_scope = 'stamp_goal' THEN 1 ELSE 0 END) AS stamp_goal, " +
      "  SUM(CASE WHEN reward_scope = 'milestone' THEN 1 ELSE 0 END) AS milestone, " +
      "  SUM(CASE WHEN reward_scope = 'system' THEN 1 ELSE 0 END) AS system " +
      "FROM rewards"
    ).one(counts);
    console.log(
      "[MIGRATION 1793000011] reward_scope backfilled: catalog=" + (counts.catalog || 0) +
      " stamp_goal=" + (counts.stamp_goal || 0) +
      " milestone=" + (counts.milestone || 0) +
      " system=" + (counts.system || 0)
    );
  } catch (err) {
    console.log("[MIGRATION 1793000011 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const rewards = app.findCollectionByNameOrId("rewards");
    if (rewards.fields.getByName("reward_scope")) {
      rewards.fields.removeByName("reward_scope");
      app.save(rewards);
    }
  } catch (err) {
    console.log("[MIGRATION 1793000011 DOWN ERROR]", err.message || err);
  }
});
