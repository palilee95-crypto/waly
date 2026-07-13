/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const loyaltyCards = app.findCollectionByNameOrId("loyalty_cards")
  loyaltyCards.updateRule = "customer = @request.auth.id || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')"
  app.save(loyaltyCards)
}, (app) => {
  const loyaltyCards = app.findCollectionByNameOrId("loyalty_cards")
  loyaltyCards.updateRule = "merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')"
  app.save(loyaltyCards)
})
