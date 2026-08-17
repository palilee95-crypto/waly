/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Add branch fields to users collection
  try {
    const usersCol = app.findCollectionByNameOrId("_pb_users_auth_");
    
    // Add branch_name field
    try {
      const existingBranchName = usersCol.fields.getByName("branch_name");
      if (!existingBranchName) {
        usersCol.fields.addAt(
          usersCol.fields.length,
          new Field({
            "id": "text_user_branch_name",
            "name": "branch_name",
            "type": "text",
            "system": false,
            "required": false,
            "presentable": false
          })
        );
      }
    } catch (e) {
      usersCol.fields.addAt(
        usersCol.fields.length,
        new Field({
          "id": "text_user_branch_name",
          "name": "branch_name",
          "type": "text",
          "system": false,
          "required": false,
          "presentable": false
        })
      );
    }

    // Add branch relation field (to branches collection)
    try {
      const existingBranch = usersCol.fields.getByName("branch");
      if (!existingBranch) {
        usersCol.fields.addAt(
          usersCol.fields.length,
          new Field({
            "id": "rel_user_branch",
            "name": "branch",
            "type": "relation",
            "system": false,
            "required": false,
            "presentable": false,
            "collectionId": "pbc_branches0000",
            "cascadeDelete": false,
            "minSelect": 0,
            "maxSelect": 1
          })
        );
      }
    } catch (e) {}

    app.save(usersCol);
    console.log("Successfully added branch fields to users collection");
  } catch (err) {
    console.log("Skip user branch fields migration: " + (err.message || err));
  }

  // 2. Update subscriptions plan select options to include "business"
  try {
    const subCol = app.findCollectionByNameOrId("subscriptions");
    const planField = subCol.fields.getByName("plan");
    if (planField) {
      planField.values = ["starter", "pro", "business"];
    }
    app.save(subCol);
    console.log("Successfully updated subscriptions plan field to include 'business'");
  } catch (err) {
    console.log("Skip subscriptions plan update: " + (err.message || err));
  }

  // 3. Update vouchers createRule to allow authorized merchant/staff creation
  try {
    const voucherCol = app.findCollectionByNameOrId("vouchers");
    voucherCol.createRule = "@request.auth.id != '' && (@request.auth.merchant_id = reward.merchant || reward.merchant.owner = @request.auth.id)";
    app.save(voucherCol);
    console.log("Successfully updated vouchers createRule");
  } catch (err) {
    console.log("Skip vouchers createRule update: " + (err.message || err));
  }

  return null;
}, (app) => {
  return null;
});
