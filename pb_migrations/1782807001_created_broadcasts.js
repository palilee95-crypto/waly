/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Add opt_in_marketing field to loyalty_cards
  try {
    const loyaltyCards = app.findCollectionByNameOrId("loyalty_cards");
    loyaltyCards.fields.addAt(7, new Field({
      "id": "bool_optin_mkt",
      "name": "opt_in_marketing",
      "type": "bool",
      "required": false,
      "presentable": false,
      "system": false
    }));
    app.save(loyaltyCards);
  } catch (err) {
    console.log("Failed to add opt_in_marketing field to loyalty_cards:", err.message || err);
  }

  // 2. Create broadcasts collection
  const collection = new Collection({
    "id": "pbc_broadcasts",
    "name": "broadcasts",
    "type": "base",
    "system": false,
    "listRule": "merchant.owner = @request.auth.id",
    "viewRule": "merchant.owner = @request.auth.id",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {},
    "fields": [
      {
        "id": "text3208210256",
        "name": "id",
        "type": "text",
        "system": true,
        "required": true,
        "primaryKey": true
      },
      {
        "id": "autodate2990389176",
        "name": "created",
        "type": "autodate",
        "system": true,
        "onCreate": true,
        "onUpdate": false
      },
      {
        "id": "autodate3332085495",
        "name": "updated",
        "type": "autodate",
        "system": true,
        "onCreate": true,
        "onUpdate": true
      },
      {
        "id": "rel_merchant_bc",
        "name": "merchant",
        "type": "relation",
        "required": true,
        "collectionId": "pbc_merchants00",
        "maxSelect": 1,
        "cascadeDelete": true
      },
      {
        "id": "text_title_bc",
        "name": "title",
        "type": "text",
        "required": true,
        "max": 100,
        "min": 0
      },
      {
        "id": "text_msg_bc",
        "name": "message",
        "type": "text",
        "required": true,
        "max": 1000,
        "min": 0
      },
      {
        "id": "rel_camp_bc",
        "name": "campaign",
        "type": "relation",
        "required": false,
        "collectionId": "pbc_campaigns",
        "maxSelect": 1
      },
      {
        "id": "num_recip_bc",
        "name": "recipients_count",
        "type": "number",
        "required": false,
        "noDecimal": true
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  // Rollback broadcasts
  try {
    const broadcasts = app.findCollectionByNameOrId("broadcasts");
    if (broadcasts) {
      app.delete(broadcasts);
    }
  } catch (err) {
    console.log("Rollback broadcasts collection failed:", err.message || err);
  }

  // Rollback loyalty_cards field
  try {
    const loyaltyCards = app.findCollectionByNameOrId("loyalty_cards");
    if (loyaltyCards) {
      loyaltyCards.fields.removeById("bool_optin_mkt");
      return app.save(loyaltyCards);
    }
  } catch (err) {
    console.log("Rollback loyalty_cards field failed:", err.message || err);
  }
});
