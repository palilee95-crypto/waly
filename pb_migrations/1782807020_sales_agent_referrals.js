/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Create sales_agents auth collection
  const salesAgents = new Collection({
    "id": "pbc_sales_agents",
    "name": "sales_agents",
    "type": "auth",
    "system": false,
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "authRule": "",
    "manageRule": null,
    "fields": [
      // Standard auth collection system fields:
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cost": 0,
        "hidden": true,
        "id": "password901924565",
        "max": 0,
        "min": 8,
        "name": "password",
        "pattern": "",
        "presentable": false,
        "required": true,
        "system": true,
        "type": "password"
      },
      {
        "autogeneratePattern": "[a-zA-Z0-9]{50}",
        "hidden": true,
        "id": "text2504183744",
        "max": 60,
        "min": 30,
        "name": "tokenKey",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "exceptDomains": null,
        "hidden": false,
        "id": "email3885137012",
        "name": "email",
        "onlyDomains": null,
        "presentable": false,
        "required": true,
        "system": true,
        "type": "email"
      },
      {
        "hidden": false,
        "id": "bool1547992806",
        "name": "emailVisibility",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool256245529",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "autodate2990389176",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": true,
        "type": "autodate"
      },
      {
        "hidden": false,
        "id": "autodate3332085495",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": true,
        "type": "autodate"
      },
      // Custom custom fields:
      {
        "id": "sa_name",
        "name": "name",
        "type": "text",
        "required": true,
        "system": false
      },
      {
        "id": "sa_referral_code",
        "name": "referral_code",
        "type": "text",
        "required": true,
        "system": false
      },
      {
        "id": "sa_commission_tier",
        "name": "commission_tier",
        "type": "select",
        "required": true,
        "system": false,
        "values": ["tier_1", "tier_2", "tier_3"],
        "maxSelect": 1
      },
      {
        "id": "sa_lifetime_earnings",
        "name": "lifetime_earnings",
        "type": "number",
        "required": false,
        "system": false
      },
      {
        "id": "sa_clicks",
        "name": "clicks",
        "type": "number",
        "required": false,
        "system": false
      },
      {
        "id": "sa_status",
        "name": "status",
        "type": "select",
        "required": true,
        "system": false,
        "values": ["active", "inactive"],
        "maxSelect": 1
      }
    ]
  });
  app.save(salesAgents);

  // 2. Add referral_code text field to merchants
  const merchants = app.findCollectionByNameOrId("merchants");
  merchants.fields.add(new Field({
    "id": "refcode_merchant",
    "name": "referral_code",
    "type": "text",
    "required": false
  }));

  // 3. Alter referred_by relation on merchants to point to sales_agents (instead of _superusers)
  merchants.fields.add(new Field({
    "id": "refby_merchant",
    "name": "referred_by",
    "type": "relation",
    "required": false,
    "collectionId": "pbc_sales_agents",
    "maxSelect": 1
  }));
  app.save(merchants);

  // 4. Alter agent relation on commissions to point to sales_agents (instead of _superusers)
  const commissions = app.findCollectionByNameOrId("commissions");
  commissions.fields.add(new Field({
    "id": "relation_comm_agent",
    "name": "agent",
    "type": "relation",
    "required": true,
    "collectionId": "pbc_sales_agents",
    "maxSelect": 1
  }));
  app.save(commissions);
}, (app) => {
  // Rollback logic
  try {
    const merchants = app.findCollectionByNameOrId("merchants");
    // Restore original referred_by relation to _superusers
    merchants.fields.add(new Field({
      "id": "refby_merchant",
      "name": "referred_by",
      "type": "relation",
      "required": false,
      "collectionId": "pbc_3142635823", // _superusers ID
      "maxSelect": 1
    }));
    merchants.fields.removeById("refcode_merchant");
    app.save(merchants);
  } catch (err) {}

  try {
    const commissions = app.findCollectionByNameOrId("commissions");
    // Restore original agent relation to _superusers
    commissions.fields.add(new Field({
      "id": "relation_comm_agent",
      "name": "agent",
      "type": "relation",
      "required": true,
      "collectionId": "pbc_3142635823", // _superusers ID
      "maxSelect": 1
    }));
    app.save(commissions);
  } catch (err) {}

  try {
    app.deleteCollection("sales_agents");
  } catch (err) {}
});
