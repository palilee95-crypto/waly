/// <reference path="../pb_data/types.d.ts" />
// Birthday wiring, phase 1.
//
// Three problems with the shipped feature:
//  1. birthday_logs had "" on every rule — anyone could read every customer's
//     birthday/voucher or forge/delete logs.
//  2. birthday_rewards.createRule allowed any authenticated user to create a
//     config for ANY merchant.
//  3. The voucher issued by the runner had no birthday-specific reward to link
//     to, so it attached the merchant's most recent catalogue reward.
//
// This migration locks the rules, adds the link fields, and makes the annual
// log unique so two overlapping cron runs cannot issue twice.
migrate((app) => {
  try {
    const configs = app.findCollectionByNameOrId("birthday_rewards");

    const addField = (config) => {
      let exists = false;
      try { exists = !!configs.fields.getByName(config.name); } catch (err) { exists = false; }
      if (exists) return false;
      configs.fields.add(new Field(config));
      return true;
    };

    // The catalogue reward that backs the birthday voucher (scope: system, so
    // it never appears as a redeemable reward).
    addField({
      id: "rel_reward_brw",
      name: "reward",
      type: "relation",
      required: false,
      system: false,
      collectionId: "pbc_rewards000",
      maxSelect: 1,
      minSelect: 0,
      cascadeDelete: false,
    });
    // The menu item the merchant picked as the gift (optional; the title still
    // carries the human-readable name).
    addField({
      id: "rel_gift_item_brw",
      name: "gift_item",
      type: "relation",
      required: false,
      system: false,
      collectionId: "pbc_services000",
      maxSelect: 1,
      minSelect: 0,
      cascadeDelete: false,
    });
    addField({
      id: "text_gift_name_brw",
      name: "gift_item_name",
      type: "text",
      required: false,
      system: false,
      max: 0,
      min: 0,
      pattern: "",
      autogeneratePattern: "",
      primaryKey: false,
      presentable: false,
    });

    configs.createRule = "merchant.owner = @request.auth.id";

    // Root cause of "no merchant has ever configured this": the id field had an
    // empty autogenerate pattern but is required, so every create from the app
    // failed with `id: cannot be blank`. Let PocketBase mint one.
    let configIdField = null;
    try { configIdField = configs.fields.getByName("id"); } catch (err) {}
    if (configIdField && !configIdField.autogeneratePattern) {
      configIdField.autogeneratePattern = "[a-z0-9]{15}";
    }

    app.save(configs);
    console.log("[MIGRATION 1793000015] Wired birthday_rewards (reward link, gift item, owner-only create, auto id)");

    const logs = app.findCollectionByNameOrId("birthday_logs");
    logs.listRule = "customer = @request.auth.id || merchant.owner = @request.auth.id";
    logs.viewRule = "customer = @request.auth.id || merchant.owner = @request.auth.id";
    // JSVM maps `null` to "" (public), so use an always-false rule to make
    // these server-only. Hooks bypass API rules, so $app.save still works.
    logs.createRule = "@request.auth.id = '__server_only__'";
    logs.updateRule = logs.createRule;
    logs.deleteRule = logs.createRule;
    logs.indexes = logs.indexes || [];
    let logIdField = null;
    try { logIdField = logs.fields.getByName("id"); } catch (err) {}
    if (logIdField && !logIdField.autogeneratePattern) {
      logIdField.autogeneratePattern = "[a-z0-9]{15}";
    }
    const index = "CREATE UNIQUE INDEX IF NOT EXISTS idx_birthday_logs_unique ON birthday_logs(customer, merchant, year)";
    if (logs.indexes.indexOf(index) < 0) {
      logs.indexes.push(index);
    }
    app.save(logs);
    console.log("[MIGRATION 1793000015] Locked birthday_logs and added the yearly unique index");
  } catch (err) {
    console.log("[MIGRATION 1793000015 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const configs = app.findCollectionByNameOrId("birthday_rewards");
    try { configs.fields.removeByName("reward"); } catch (err) {}
    try { configs.fields.removeByName("gift_item"); } catch (err) {}
    try { configs.fields.removeByName("gift_item_name"); } catch (err) {}
    configs.createRule = "@request.auth.id != ''";
    app.save(configs);

    const logs = app.findCollectionByNameOrId("birthday_logs");
    logs.listRule = "";
    logs.viewRule = "";
    logs.createRule = "";
    logs.updateRule = "";
    logs.deleteRule = "";
    logs.indexes = (logs.indexes || []).filter(function (idx) {
      return idx.indexOf("idx_birthday_logs_unique") < 0;
    });
    app.save(logs);
  } catch (err) {
    console.log("[MIGRATION 1793000015 DOWN ERROR]", err.message || err);
  }
});
