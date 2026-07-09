/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Add fields to _superusers
  try {
    const superusers = app.findCollectionByNameOrId("_superusers");
    if (superusers) {
      superusers.fields.add(new Field({
        "id": "role_superuser",
        "name": "role",
        "type": "select",
        "required": false,
        "values": ["super_admin", "operations", "analyst", "support", "sales_agent"],
        "maxSelect": 1
      }));

      superusers.fields.add(new Field({
        "id": "refcode_superuser",
        "name": "referral_code",
        "type": "text",
        "required": false
      }));

      superusers.fields.add(new Field({
        "id": "commtier_superuser",
        "name": "commission_tier",
        "type": "select",
        "required": false,
        "values": ["tier_1", "tier_2", "tier_3"],
        "maxSelect": 1
      }));

      superusers.fields.add(new Field({
        "id": "lifearn_superuser",
        "name": "lifetime_earnings",
        "type": "number",
        "required": false
      }));

      app.save(superusers);
      console.log("Successfully added role, referral_code, commission_tier, and lifetime_earnings to _superusers collection!");
    }
  } catch (err) {
    console.log("Failed to extend _superusers fields:", err.message || err);
  }

  // 2. Add referred_by field to merchants
  try {
    const merchants = app.findCollectionByNameOrId("merchants");
    if (merchants) {
      merchants.fields.add(new Field({
        "id": "refby_merchant",
        "name": "referred_by",
        "type": "relation",
        "required": false,
        "collectionId": "pbc_3142635823", // _superusers collection ID
        "maxSelect": 1
      }));
      app.save(merchants);
      console.log("Successfully added referred_by relation field to merchants collection!");
    }
  } catch (err) {
    console.log("Failed to add referred_by to merchants:", err.message || err);
  }

  // 3. Create commissions collection
  try {
    const commissions = new Collection({
      "id": "pbc_commissions",
      "name": "commissions",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != ''",
      "viewRule": "@request.auth.id != ''",
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
          "id": "rel_agent_comm",
          "name": "agent",
          "type": "relation",
          "required": true,
          "collectionId": "pbc_3142635823", // _superusers
          "maxSelect": 1
        },
        {
          "id": "rel_merch_comm",
          "name": "referred_merchant",
          "type": "relation",
          "required": true,
          "collectionId": "pbc_merchants00", // merchants
          "maxSelect": 1
        },
        {
          "id": "num_sales_comm",
          "name": "sales_amount",
          "type": "number",
          "required": true
        },
        {
          "id": "num_rate_comm",
          "name": "commission_rate",
          "type": "number",
          "required": true
        },
        {
          "id": "num_amt_comm",
          "name": "commission_amount",
          "type": "number",
          "required": true
        },
        {
          "id": "sel_status_comm",
          "name": "status",
          "type": "select",
          "required": true,
          "values": ["pending", "paid"],
          "maxSelect": 1
        }
      ]
    });
    app.save(commissions);
    console.log("Successfully created commissions collection!");
  } catch (err) {
    console.log("Failed to create commissions collection:", err.message || err);
  }
}, (app) => {
  // Rollback commissions
  try {
    const commissions = app.findCollectionByNameOrId("commissions");
    if (commissions) {
      app.delete(commissions);
    }
  } catch (err) {
    console.log("Rollback commissions collection failed:", err.message || err);
  }

  // Rollback merchants referred_by field
  try {
    const merchants = app.findCollectionByNameOrId("merchants");
    if (merchants) {
      merchants.fields.removeById("refby_merchant");
      app.save(merchants);
    }
  } catch (err) {
    console.log("Rollback merchants field failed:", err.message || err);
  }

  // Rollback _superusers fields
  try {
    const superusers = app.findCollectionByNameOrId("_superusers");
    if (superusers) {
      superusers.fields.removeById("role_superuser");
      superusers.fields.removeById("refcode_superuser");
      superusers.fields.removeById("commtier_superuser");
      superusers.fields.removeById("lifearn_superuser");
      app.save(superusers);
    }
  } catch (err) {
    console.log("Rollback _superusers fields failed:", err.message || err);
  }
});
