/// <reference path="../pb_data/types.d.ts" />
// Merchant add-ons — purchased entitlements that sit on top of a plan.
//
// First use case: lifetime customer-slot top-ups for Stand Bundle merchants
// who hit the 500-member cap but do not want Starter/PRO.
//
// Deliberately a separate collection rather than a subscriptions column:
//   - purchases must survive plan changes / new subscription rows;
//   - the shape is extensible (extra_branch, whatsapp_automation later);
//   - writes are server-side only, same lockdown as `subscriptions`.

migrate((app) => {
  try {
    app.findCollectionByNameOrId("merchant_addons");
    console.log("[MIGRATION 1782807093] merchant_addons already exists, skipping");
    return null;
  } catch (e) { /* create below */ }

  try {
    const collection = new Collection({
      "name": "merchant_addons",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != '' && (merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))",
      "viewRule": "@request.auth.id != '' && (merchant.owner = @request.auth.id || (@request.auth.merchant_id = merchant.id && @request.auth.merchant_id != ''))",
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "options": {},
      "fields": [
        { "id": "text_id_addon", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
        { "id": "autodate_cr_addon", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate_up_addon", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_merch_addon", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": "pbc_merchants00", "cascadeDelete": true, "minSelect": 0, "maxSelect": 1 },
        { "id": "sel_type_addon", "name": "type", "type": "select", "system": false, "required": true, "values": ["customer_quota", "extra_branch", "whatsapp_automation"] },
        { "id": "num_qty_addon", "name": "quantity", "type": "number", "system": false, "required": true },
        { "id": "sel_status_addon", "name": "status", "type": "select", "system": false, "required": true, "values": ["pending", "active", "expired", "cancelled", "refunded"] },
        { "id": "text_order_addon", "name": "order_ref", "type": "text", "system": false, "required": false },
        { "id": "text_pay_addon", "name": "payment_ref", "type": "text", "system": false, "required": false },
        { "id": "text_prov_addon", "name": "payment_provider", "type": "text", "system": false, "required": false },
        { "id": "num_amount_addon", "name": "amount", "type": "number", "system": false, "required": false },
        { "id": "num_unit_addon", "name": "unit_price", "type": "number", "system": false, "required": false },
        { "id": "date_purch_addon", "name": "purchased_at", "type": "date", "system": false, "required": false },
        { "id": "date_exp_addon", "name": "expires_at", "type": "date", "system": false, "required": false },
        { "id": "text_note_addon", "name": "note", "type": "text", "system": false, "required": false }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX `idx_addon_payment_ref` ON `merchant_addons` (`payment_ref`) WHERE `payment_ref` != ''"
      ]
    });
    app.save(collection);
    console.log("[MIGRATION 1782807093] Created merchant_addons collection (rules: merchant read, superuser write)");
  } catch (err) {
    console.log("[MIGRATION 1782807093] merchant_addons:", err.message || err);
  }
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("merchant_addons");
    return app.delete(col);
  } catch (err) {
    return null;
  }
});
