/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const subCol = app.findCollectionByNameOrId("subscriptions");
    if (subCol) {
      // Allow merchant owner OR staff belonging to the merchant to view/list subscription status
      subCol.listRule = "@request.auth.id != '' && (merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))";
      subCol.viewRule = "@request.auth.id != '' && (merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))";
      app.save(subCol);
      console.log("[Migration] Updated subscriptions listRule & viewRule to allow authorized staff");
    }
  } catch (err) {
    console.log("[Migration] Error updating subscriptions rules:", err.message || err);
  }

  return null;
}, (app) => {
  try {
    const subCol = app.findCollectionByNameOrId("subscriptions");
    if (subCol) {
      subCol.listRule = "@request.auth.id != '' && merchant.owner = @request.auth.id";
      subCol.viewRule = "@request.auth.id != '' && merchant.owner = @request.auth.id";
      app.save(subCol);
    }
  } catch (err) {}
  return null;
});
