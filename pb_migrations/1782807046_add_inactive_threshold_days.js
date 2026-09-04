migrate((db) => {
  const collection = new Collection({
    "id": "merchants",
    "name": "merchants",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "inactive_threshold_days",
        "name": "inactive_threshold_days",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 1,
          "max": 365,
          "noDecimal": true
        }
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  const dao = new Dao(db);
  const merchants = dao.findCollectionByNameOrId("merchants");
  
  // Add the new field
  merchants.schema.addField(new SchemaField({
    "system": false,
    "id": "inactive_threshold_days",
    "name": "inactive_threshold_days",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": 1,
      "max": 365,
      "noDecimal": true
    }
  }));

  return dao.saveCollection(merchants);
}, (db) => {
  const dao = new Dao(db);
  const merchants = dao.findCollectionByNameOrId("merchants");

  // Remove the field
  merchants.schema.removeField("inactive_threshold_days");

  return dao.saveCollection(merchants);
});
