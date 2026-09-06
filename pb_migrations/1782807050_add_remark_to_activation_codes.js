/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const activationCodes = app.findCollectionByNameOrId("activation_codes");
    if (!activationCodes) return null;

    let hasField = false;
    try {
      if (activationCodes.fields.getByName("remark")) {
        hasField = true;
      }
    } catch (e) {}

    if (!hasField) {
      activationCodes.fields.add(new Field({
        "id": "text_remark_act",
        "name": "remark",
        "type": "text",
        "system": false,
        "required": false,
        "presentable": false
      }));
      app.save(activationCodes);
      console.log("[MIGRATION] Added remark to activation_codes collection.");
    }
    return null;
  } catch (err) {
    console.log("[MIGRATION WARNING] Failed to add remark to activation_codes:", err.message || err);
    return null;
  }
}, (app) => {
  try {
    const activationCodes = app.findCollectionByNameOrId("activation_codes");
    if (activationCodes) {
      activationCodes.fields.removeByName("remark");
      app.save(activationCodes);
    }
  } catch (err) {}
  return null;
});
