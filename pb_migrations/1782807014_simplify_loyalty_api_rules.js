/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const loyaltyPrograms = app.findCollectionByNameOrId("loyalty_programs");
  loyaltyPrograms.createRule = "@request.auth.id != '' && merchant.owner = @request.auth.id";
  loyaltyPrograms.updateRule = "merchant.owner = @request.auth.id";
  app.save(loyaltyPrograms);

  const rewards = app.findCollectionByNameOrId("rewards");
  rewards.createRule = "merchant.owner = @request.auth.id";
  rewards.updateRule = "merchant.owner = @request.auth.id";
  app.save(rewards);
}, (app) => {
  const loyaltyPrograms = app.findCollectionByNameOrId("loyalty_programs");
  loyaltyPrograms.createRule = "@request.auth.id != '' && merchant.owner = @request.auth.id && merchant.status = 'active'";
  loyaltyPrograms.updateRule = "merchant.owner = @request.auth.id && merchant.status = 'active'";
  app.save(loyaltyPrograms);

  const rewards = app.findCollectionByNameOrId("rewards");
  rewards.createRule = "merchant.owner = @request.auth.id && merchant.status = 'active'";
  rewards.updateRule = "merchant.owner = @request.auth.id && merchant.status = 'active'";
  app.save(rewards);
})
