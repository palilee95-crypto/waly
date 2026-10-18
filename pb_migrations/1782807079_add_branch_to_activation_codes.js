/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const activationCodes = app.findCollectionByNameOrId("activation_codes");
    if (!activationCodes) return null;

    let hasField = false;
    try {
      if (activationCodes.fields.getByName("branch")) {
        hasField = true;
      }
    } catch (e) {}

    if (!hasField) {
      activationCodes.fields.add(new Field({
        "id": "rel_branch_act",
        "name": "branch",
        "type": "relation",
        "system": false,
        "required": false,
        "presentable": false,
        "collectionId": "pbc_branches0000",
        "cascadeDelete": false,
        "minSelect": 0,
        "maxSelect": 1
      }));
      app.save(activationCodes);
      console.log("[MIGRATION] Added branch relation to activation_codes collection.");
    }
    return null;
  } catch (err) {
    console.log("[MIGRATION WARNING] Failed to add branch to activation_codes:", err.message || err);
    return null;
  }
}, (app) => {
  try {
    const activationCodes = app.findCollectionByNameOrId("activation_codes");
    if (activationCodes) {
      activationCodes.fields.removeByName("branch");
      app.save(activationCodes);
    }
  } catch (err) {}
  return null;
});
