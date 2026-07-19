/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "pbc_prospects_",
    "name": "prospects",
    "type": "base",
    "system": false,
    "listRule": "agent = @request.auth.id",
    "viewRule": "agent = @request.auth.id",
    "createRule": "@request.auth.id != ''",
    "updateRule": "agent = @request.auth.id",
    "deleteRule": "agent = @request.auth.id",
    "options": {},
    "fields": [
      {
        "id": "text_id_pros",
        "name": "id",
        "type": "text",
        "system": true,
        "required": true,
        "primaryKey": true
      },
      {
        "id": "autodate_created_pros",
        "name": "created",
        "type": "autodate",
        "system": true,
        "onCreate": true,
        "onUpdate": false
      },
      {
        "id": "autodate_updated_pros",
        "name": "updated",
        "type": "autodate",
        "system": true,
        "onCreate": true,
        "onUpdate": true
      },
      {
        "id": "text_phone_pros",
        "name": "phone",
        "type": "text",
        "required": true
      },
      {
        "id": "rel_agent_pros",
        "name": "agent",
        "type": "relation",
        "required": true,
        "collectionId": "pbc_sales_agents",
        "maxSelect": 1,
        "cascadeDelete": false
      },
      {
        "id": "select_status_pros",
        "name": "status",
        "type": "select",
        "required": false,
        "maxSelect": 1,
        "values": ["lead", "registered", "converted"]
      },
      {
        "id": "date_lastcontacted_pros",
        "name": "last_contacted",
        "type": "date",
        "required": false
      },
      {
        "id": "text_notes_pros",
        "name": "notes",
        "type": "text",
        "required": false
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("prospects");
  if (collection) {
    app.delete(collection);
  }
});