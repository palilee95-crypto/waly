/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const loyaltyCards = app.findCollectionByNameOrId("loyalty_cards")
  loyaltyCards.listRule = "customer = @request.auth.id || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')"
  loyaltyCards.viewRule = "customer = @request.auth.id || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')"
  loyaltyCards.updateRule = "merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')"
  app.save(loyaltyCards)

  const transactions = app.findCollectionByNameOrId("transactions")
  transactions.listRule = "customer = @request.auth.id || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')"
  transactions.viewRule = "customer = @request.auth.id || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')"
  app.save(transactions)
}, (app) => {
  const loyaltyCards = app.findCollectionByNameOrId("loyalty_cards")
  loyaltyCards.listRule = "customer = @request.auth.id || merchant.owner = @request.auth.id"
  loyaltyCards.viewRule = "customer = @request.auth.id || merchant.owner = @request.auth.id"
  loyaltyCards.updateRule = "merchant.owner = @request.auth.id"
  app.save(loyaltyCards)

  const transactions = app.findCollectionByNameOrId("transactions")
  transactions.listRule = "customer = @request.auth.id || merchant.owner = @request.auth.id"
  transactions.viewRule = "customer = @request.auth.id || merchant.owner = @request.auth.id"
  app.save(transactions)
})
