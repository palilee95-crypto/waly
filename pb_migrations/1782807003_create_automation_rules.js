/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_auto_rules",
    "name": "automation_rules",
    "type": "base",
    "system": false,
    "listRule": "merchant.owner = @request.auth.id",
    "viewRule": "merchant.owner = @request.auth.id",
    "createRule": "merchant.owner = @request.auth.id",
    "updateRule": "merchant.owner = @request.auth.id",
    "deleteRule": "merchant.owner = @request.auth.id",
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
        "id": "rel_merchant_ar",
        "name": "merchant",
        "type": "relation",
        "required": true,
        "collectionId": "pbc_merchants00",
        "maxSelect": 1,
        "cascadeDelete": true
      },
      {
        "id": "text_name_ar",
        "name": "name",
        "type": "text",
        "required": true
      },
      {
        "id": "num_days_ar",
        "name": "trigger_days",
        "type": "number",
        "required": true,
        "noDecimal": true
      },
      {
        "id": "text_title_ar",
        "name": "title",
        "type": "text",
        "required": true
      },
      {
        "id": "text_msg_ar",
        "name": "message",
        "type": "text",
        "required": true
      },
      {
        "id": "bool_whatsapp_ar",
        "name": "send_whatsapp",
        "type": "bool",
        "required": false
      },
      {
        "id": "bool_active_ar",
        "name": "is_active",
        "type": "bool",
        "required": false
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("automation_rules");
  if (collection) {
    app.delete(collection);
  }
});
