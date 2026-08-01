/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    app.findCollectionByNameOrId("birthday_logs");
    console.log("Collection birthday_logs already exists, skipping creation");
  } catch (e) {
    const collection = new Collection({
      "id": "pbc_bday_logs",
      "name": "birthday_logs",
      "type": "base",
      "system": false,
      "listRule": "",
      "viewRule": "",
      "createRule": "",
      "updateRule": "",
      "deleteRule": "",
      "options": {},
      "fields": [
        {
          "id": "text_id_bday_log",
          "name": "id",
          "type": "text",
          "system": true,
          "required": true,
          "primaryKey": true
        },
        {
          "id": "autodate_created_blg",
          "name": "created",
          "type": "autodate",
          "system": true,
          "onCreate": true,
          "onUpdate": false
        },
        {
          "id": "autodate_updated_blg",
          "name": "updated",
          "type": "autodate",
          "system": true,
          "onCreate": true,
          "onUpdate": true
        },
        {
          "id": "rel_customer_blg",
          "name": "customer",
          "type": "relation",
          "system": false,
          "required": true,
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": true,
          "minSelect": 0,
          "maxSelect": 1,
          "displayFields": null
        },
        {
          "id": "rel_merchant_blg",
          "name": "merchant",
          "type": "relation",
          "system": false,
          "required": true,
          "collectionId": "pbc_merchants00",
          "cascadeDelete": false,
          "minSelect": 0,
          "maxSelect": 1,
          "displayFields": null
        },
        {
          "id": "rel_reward_blg",
          "name": "reward",
          "type": "relation",
          "system": false,
          "required": true,
          "collectionId": "pbc_bday_rewards",
          "cascadeDelete": false,
          "minSelect": 0,
          "maxSelect": 1,
          "displayFields": null
        },
        {
          "id": "rel_voucher_blg",
          "name": "voucher",
          "type": "relation",
          "system": false,
          "required": false,
          "collectionId": "pbc_vouchers0",
          "cascadeDelete": false,
          "minSelect": 0,
          "maxSelect": 1,
          "displayFields": null
        },
        {
          "id": "num_year_blg",
          "name": "year",
          "type": "number",
          "system": false,
          "required": true,
          "min": 2000,
          "max": 2100
        },
        {
          "id": "sel_status_blg",
          "name": "status",
          "type": "select",
          "system": false,
          "required": true,
          "presentable": false,
          "values": ["pending", "sent", "failed", "redeemed"]
        },
        {
          "id": "text_ab_group_blg",
          "name": "ab_group",
          "type": "text",
          "system": false,
          "required": false
        },
        {
          "id": "text_error_blg",
          "name": "error_message",
          "type": "text",
          "system": false,
          "required": false
        }
      ]
    })

    return app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_bday_logs")
  return app.delete(collection)
})