/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("push_subscriptions");
    console.log("Collection push_subscriptions already exists, skipping creation");
    return null;
  } catch (e) { /* create below */ }

  try {
    const usersCol = app.findCollectionByNameOrId("users");
    const merchantsCol = app.findCollectionByNameOrId("merchants");
    let branchesColId = "pbc_branches0000";
    try {
      branchesColId = app.findCollectionByNameOrId("branches").id;
    } catch (bErr) {}

    const collection = new Collection({
      "id": "pbc_push_sub000",
      "name": "push_subscriptions",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != '' && user = @request.auth.id",
      "viewRule": "@request.auth.id != '' && user = @request.auth.id",
      "createRule": "@request.auth.id != '' && user = @request.auth.id",
      "updateRule": "@request.auth.id != '' && user = @request.auth.id",
      "deleteRule": "@request.auth.id != '' && user = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text_id_ps", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
        { "id": "autodate_cr_ps", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_ps", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_user_ps", "name": "user", "type": "relation", "system": false, "required": true, "collectionId": usersCol.id, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "rel_merchant_ps", "name": "merchant", "type": "relation", "system": false, "required": false, "collectionId": merchantsCol.id, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "rel_branch_ps", "name": "branch", "type": "relation", "system": false, "required": false, "collectionId": branchesColId, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "text_endpoint_ps", "name": "endpoint", "type": "text", "system": false, "required": true },
        { "id": "text_p256dh_ps", "name": "p256dh", "type": "text", "system": false, "required": true },
        { "id": "text_auth_ps", "name": "auth", "type": "text", "system": false, "required": true },
        { "id": "text_device_ps", "name": "device", "type": "text", "system": false, "required": false }
      ]
    });
    const saved = app.save(collection);
    console.log("Successfully created push_subscriptions collection");
    return saved;
  } catch (err) {
    console.log("Skip push_subscriptions migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("push_subscriptions");
    return app.delete(col);
  } catch (err) {
    return null;
  }
});
