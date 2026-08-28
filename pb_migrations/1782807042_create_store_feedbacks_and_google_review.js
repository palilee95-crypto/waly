/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Add google_review_url and enable_review_prompt to merchants
  try {
    const merchantsCol = app.findCollectionByNameOrId("pbc_merchants00");
    try {
      merchantsCol.fields.addAt(merchantsCol.fields.length,
        new Field({
          "id": "text_google_review_url",
          "name": "google_review_url",
          "type": "text",
          "system": false,
          "required": false
        })
      );
    } catch (e) {}

    try {
      merchantsCol.fields.addAt(merchantsCol.fields.length,
        new Field({
          "id": "bool_enable_review_prompt",
          "name": "enable_review_prompt",
          "type": "bool",
          "system": false,
          "required": false
        })
      );
    } catch (e) {}

    app.save(merchantsCol);
  } catch (err) {
    console.log("Skip merchants review fields migration: " + (err.message || err));
  }

  // 2. Create store_feedbacks collection
  try {
    try {
      app.findCollectionByNameOrId("store_feedbacks");
      console.log("Collection store_feedbacks already exists, skipping creation");
      return null;
    } catch (e) { /* create below */ }

    const collection = new Collection({
      "id": "pbc_feedbacks00",
      "name": "store_feedbacks",
      "type": "base",
      "system": false,
      "listRule": "merchant.owner = @request.auth.id",
      "viewRule": "merchant.owner = @request.auth.id",
      "createRule": "",
      "updateRule": "merchant.owner = @request.auth.id",
      "deleteRule": "merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text_id_fb", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate_cr_fb", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_fb", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_merchant_fb", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": "pbc_merchants00", "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
        { "id": "text_cphone_fb", "name": "customer_phone", "type": "text", "system": false, "required": false },
        { "id": "text_cname_fb", "name": "customer_name", "type": "text", "system": false, "required": false },
        { "id": "num_rating_fb", "name": "rating", "type": "number", "system": false, "required": true, "min": 1, "max": 5 },
        { "id": "text_comment_fb", "name": "feedback", "type": "text", "system": false, "required": false },
        { "id": "bool_google_fb", "name": "redirected_to_google", "type": "bool", "system": false, "required": false }
      ]
    });
    return app.save(collection);
  } catch (err) {
    console.log("Skip store_feedbacks creation: " + (err.message || err));
    return null;
  }
}, (app) => {
  return null;
})
