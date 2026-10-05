/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // 1. Update merchants collection with booking addon & PWA fields
    try {
      const merchantsCol = app.findCollectionByNameOrId("pbc_merchants00") || app.findCollectionByNameOrId("merchants");
      if (merchantsCol) {
        try {
          merchantsCol.fields.add(new Field({
            "id": "bool_has_bk_addon",
            "name": "has_booking_addon",
            "type": "bool",
            "required": false
          }));
        } catch (e) {}

        try {
          merchantsCol.fields.add(new Field({
            "id": "text_pwa_slug",
            "name": "pwa_slug",
            "type": "text",
            "required": false
          }));
        } catch (e) {}

        try {
          merchantsCol.fields.add(new Field({
            "id": "text_pwa_color",
            "name": "pwa_brand_color",
            "type": "text",
            "required": false
          }));
        } catch (e) {}

        app.save(merchantsCol);
        console.log("[MIGRATION 1782807055] Successfully added booking fields to merchants");
      }
    } catch (mErr) {
      console.log("[MIGRATION 1782807055] merchants note:", mErr.message || mErr);
    }

    const merchantsCol = app.findCollectionByNameOrId("pbc_merchants00") || app.findCollectionByNameOrId("merchants");
    const merchantsColId = merchantsCol ? merchantsCol.id : "pbc_merchants00";

    let branchesColId = "pbc_branches0000";
    try {
      branchesColId = app.findCollectionByNameOrId("branches").id;
    } catch (bErr) {}

    // 2. Create merchant_services collection
    try {
      app.findCollectionByNameOrId("merchant_services");
      console.log("Collection merchant_services already exists, skipping");
    } catch (e) {
      const servicesCol = new Collection({
        "id": "pbc_services000",
        "name": "merchant_services",
        "type": "base",
        "system": false,
        "listRule": "",
        "viewRule": "",
        "createRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "updateRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "deleteRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "options": {},
        "fields": [
          { "id": "text_id_srv", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
          { "id": "autodate_cr_srv", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
          { "id": "autodate_up_srv", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
          { "id": "rel_merchant_srv", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": merchantsColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "rel_branch_srv", "name": "branch", "type": "relation", "system": false, "required": false, "collectionId": branchesColId, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "text_cat_srv", "name": "category", "type": "text", "system": false, "required": false },
          { "id": "text_name_srv", "name": "name", "type": "text", "system": false, "required": true },
          { "id": "text_desc_srv", "name": "description", "type": "text", "system": false, "required": false },
          { "id": "num_price_srv", "name": "price", "type": "number", "system": false, "required": true },
          { "id": "num_dur_srv", "name": "duration_minutes", "type": "number", "system": false, "required": false },
          { "id": "sel_type_srv", "name": "item_type", "type": "select", "system": false, "required": false, "values": ["service", "product"] },
          { "id": "bool_active_srv", "name": "is_active", "type": "bool", "system": false, "required": false },
          { "id": "num_sort_srv", "name": "sort_order", "type": "number", "system": false, "required": false }
        ]
      });
      app.save(servicesCol);
      console.log("[MIGRATION 1782807055] Successfully created merchant_services collection");
    }

    // 3. Create merchant_staff collection
    try {
      app.findCollectionByNameOrId("merchant_staff");
      console.log("Collection merchant_staff already exists, skipping");
    } catch (e) {
      const staffCol = new Collection({
        "id": "pbc_staff000000",
        "name": "merchant_staff",
        "type": "base",
        "system": false,
        "listRule": "",
        "viewRule": "",
        "createRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "updateRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "deleteRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "options": {},
        "fields": [
          { "id": "text_id_stf", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
          { "id": "autodate_cr_stf", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
          { "id": "autodate_up_stf", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
          { "id": "rel_merchant_stf", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": merchantsColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "rel_branch_stf", "name": "branch", "type": "relation", "system": false, "required": false, "collectionId": branchesColId, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "text_name_stf", "name": "name", "type": "text", "system": false, "required": true },
          { "id": "text_role_stf", "name": "role_title", "type": "text", "system": false, "required": false },
          { "id": "text_phone_stf", "name": "phone", "type": "text", "system": false, "required": false },
          { "id": "json_days_stf", "name": "working_days", "type": "json", "system": false, "required": false },
          { "id": "bool_active_stf", "name": "is_active", "type": "bool", "system": false, "required": false },
          { "id": "num_sort_stf", "name": "sort_order", "type": "number", "system": false, "required": false }
        ]
      });
      app.save(staffCol);
      console.log("[MIGRATION 1782807055] Successfully created merchant_staff collection");
    }

    // 4. Create service_bookings collection
    try {
      app.findCollectionByNameOrId("service_bookings");
      console.log("Collection service_bookings already exists, skipping");
    } catch (e) {
      let staffColId = "pbc_staff000000";
      try {
        staffColId = app.findCollectionByNameOrId("merchant_staff").id;
      } catch (stErr) {}

      const bookingsCol = new Collection({
        "id": "pbc_bookings000",
        "name": "service_bookings",
        "type": "base",
        "system": false,
        "listRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "viewRule": "",
        "createRule": "",
        "updateRule": "",
        "deleteRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "options": {},
        "fields": [
          { "id": "text_id_bkg", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
          { "id": "autodate_cr_bkg", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
          { "id": "autodate_up_bkg", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
          { "id": "rel_merchant_bkg", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": merchantsColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "rel_branch_bkg", "name": "branch", "type": "relation", "system": false, "required": false, "collectionId": branchesColId, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "rel_staff_bkg", "name": "staff", "type": "relation", "system": false, "required": false, "collectionId": staffColId, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "text_cname_bkg", "name": "customer_name", "type": "text", "system": false, "required": true },
          { "id": "text_cphone_bkg", "name": "customer_phone", "type": "text", "system": false, "required": true },
          { "id": "text_date_bkg", "name": "booking_date", "type": "text", "system": false, "required": true },
          { "id": "text_stime_bkg", "name": "start_time", "type": "text", "system": false, "required": true },
          { "id": "text_etime_bkg", "name": "end_time", "type": "text", "system": false, "required": false },
          { "id": "json_items_bkg", "name": "items_summary", "type": "json", "system": false, "required": false },
          { "id": "num_total_bkg", "name": "total_price", "type": "number", "system": false, "required": false },
          { "id": "text_notes_bkg", "name": "notes", "type": "text", "system": false, "required": false },
          { "id": "sel_status_bkg", "name": "status", "type": "select", "system": false, "required": true, "values": ["booked", "arrived", "in_service", "completed", "cancelled", "no_show"] }
        ]
      });
      app.save(bookingsCol);
      console.log("[MIGRATION 1782807055] Successfully created service_bookings collection");
    }

    // 5. Create digital_receipts collection
    try {
      app.findCollectionByNameOrId("digital_receipts");
      console.log("Collection digital_receipts already exists, skipping");
    } catch (e) {
      let bookingsColId = "pbc_bookings000";
      try {
        bookingsColId = app.findCollectionByNameOrId("service_bookings").id;
      } catch (bkErr) {}

      const receiptsCol = new Collection({
        "id": "pbc_receipts00",
        "name": "digital_receipts",
        "type": "base",
        "system": false,
        "listRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "viewRule": "",
        "createRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "updateRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "deleteRule": "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)",
        "options": {},
        "fields": [
          { "id": "text_id_rec", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true, "autogeneratePattern": "[a-z0-9]{15}" },
          { "id": "autodate_cr_rec", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
          { "id": "autodate_up_rec", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
          { "id": "rel_merchant_rec", "name": "merchant", "type": "relation", "system": false, "required": true, "collectionId": merchantsColId, "cascadeDelete": true, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "rel_booking_rec", "name": "booking", "type": "relation", "system": false, "required": false, "collectionId": bookingsColId, "cascadeDelete": false, "minSelect": 0, "maxSelect": 1, "displayFields": null },
          { "id": "text_cphone_rec", "name": "customer_phone", "type": "text", "system": false, "required": true },
          { "id": "text_recnum_rec", "name": "receipt_number", "type": "text", "system": false, "required": true },
          { "id": "json_lines_rec", "name": "line_items", "type": "json", "system": false, "required": false },
          { "id": "num_total_rec", "name": "total_amount", "type": "number", "system": false, "required": true },
          { "id": "text_method_rec", "name": "payment_method", "type": "text", "system": false, "required": false },
          { "id": "num_stamps_rec", "name": "stamps_earned", "type": "number", "system": false, "required": false }
        ]
      });
      app.save(receiptsCol);
      console.log("[MIGRATION 1782807055] Successfully created digital_receipts collection");
    }

  } catch (err) {
    console.log("[MIGRATION 1782807055] Global Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
