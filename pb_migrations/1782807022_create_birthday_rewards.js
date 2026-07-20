/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_bday_rewards",
    "name": "birthday_rewards",
    "type": "base",
    "system": false,
    "listRule": "merchant.owner = @request.auth.id",
    "viewRule": "merchant.owner = @request.auth.id",
    "createRule": "@request.auth.id != ''",
    "updateRule": "merchant.owner = @request.auth.id",
    "deleteRule": "merchant.owner = @request.auth.id",
    "options": {},
    "fields": [
      {
        "id": "text_id_bday_rw",
        "name": "id",
        "type": "text",
        "system": true,
        "required": true,
        "primaryKey": true
      },
      {
        "id": "autodate_created_brw",
        "name": "created",
        "type": "autodate",
        "system": true,
        "onCreate": true,
        "onUpdate": false
      },
      {
        "id": "autodate_updated_brw",
        "name": "updated",
        "type": "autodate",
        "system": true,
        "onCreate": true,
        "onUpdate": true
      },
      {
        "id": "rel_merchant_brw",
        "name": "merchant",
        "type": "relation",
        "system": false,
        "required": true,
        "collectionId": "pbc_merchants00",
        "cascadeDelete": true,
        "minSelect": 0,
        "maxSelect": 1,
        "displayFields": null
      },
      {
        "id": "sel_rw_type_brw",
        "name": "reward_type",
        "type": "select",
        "system": false,
        "required": true,
        "presentable": false,
        "values": ["voucher_code", "stamps", "discount_percent", "free_item"]
      },
      {
        "id": "text_rw_value_brw",
        "name": "reward_value",
        "type": "text",
        "system": false,
        "required": false
      },
      {
        "id": "text_title_brw",
        "name": "title",
        "type": "text",
        "system": false,
        "required": true
      },
      {
        "id": "text_desc_brw",
        "name": "description",
        "type": "text",
        "system": false,
        "required": false
      },
      {
        "id": "text_msg_tpl_brw",
        "name": "message_template",
        "type": "text",
        "system": false,
        "required": true
      },
      {
        "id": "text_msg_tpl_b_brw",
        "name": "message_template_b",
        "type": "text",
        "system": false,
        "required": false
      },
      {
        "id": "num_expiry_days_brw",
        "name": "expiry_days",
        "type": "number",
        "system": false,
        "required": true,
        "min": 1,
        "max": 365
      },
      {
        "id": "text_send_time_brw",
        "name": "send_time",
        "type": "text",
        "system": false,
        "required": true
      },
      {
        "id": "bool_is_active_brw",
        "name": "is_active",
        "type": "bool",
        "system": false,
        "required": false
      }
    ]
  })

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_bday_rewards")
  return app.delete(collection)
})