/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Delete existing follow_up_groups if it exists (from earlier MCP attempt)
  try {
    const existing = app.findCollectionByNameOrId("follow_up_groups");
    if (existing) app.delete(existing);
  } catch (e) {}

  // ── 1. follow_up_groups ──
  try {
    const groups = new Collection({
      "name": "follow_up_groups",
      "type": "base",
      "system": false,
      "listRule": "merchant.owner = @request.auth.id",
      "viewRule": "merchant.owner = @request.auth.id",
      "createRule": "merchant.owner = @request.auth.id",
      "updateRule": "merchant.owner = @request.auth.id",
      "deleteRule": "merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text3208210256", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate2990389176", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate3332085495", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_fug_merchant", "name": "merchant", "type": "relation", "required": true, "collectionId": "pbc_merchants00", "maxSelect": 1 },
        { "id": "text_fug_name", "name": "name", "type": "text", "required": true },
        { "id": "sel_fug_status", "name": "status", "type": "select", "required": true, "values": ["draft", "active", "paused", "archived"], "maxSelect": 1 },
        { "id": "bool_fug_arch", "name": "archive_after_send", "type": "bool", "required": false },
        { "id": "num_fug_interval", "name": "interval_minutes", "type": "number", "required": false },
        { "id": "num_fug_memcount", "name": "member_count", "type": "number", "required": false },
        { "id": "num_fug_seqcount", "name": "sequence_count", "type": "number", "required": false }
      ]
    });
    app.save(groups);
    console.log("Created follow_up_groups collection");
  } catch (err) {
    console.log("Failed to create follow_up_groups:", err.message || err);
  }

  // ── 2. follow_up_sequences ──
  try {
    const groupsCol = app.findCollectionByNameOrId("follow_up_groups");
    const sequences = new Collection({
      "name": "follow_up_sequences",
      "type": "base",
      "system": false,
      "listRule": "group.merchant.owner = @request.auth.id",
      "viewRule": "group.merchant.owner = @request.auth.id",
      "createRule": "group.merchant.owner = @request.auth.id",
      "updateRule": "group.merchant.owner = @request.auth.id",
      "deleteRule": "group.merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text3208210256", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate2990389176", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate3332085495", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_fus_group", "name": "group", "type": "relation", "required": true, "collectionId": groupsCol.id, "maxSelect": 1, "cascadeDelete": true },
        { "id": "text_fus_title", "name": "title", "type": "text", "required": true },
        { "id": "sel_fus_status", "name": "status", "type": "select", "required": true, "values": ["active", "inactive"], "maxSelect": 1 },
        { "id": "num_fus_days", "name": "send_after_days", "type": "number", "required": true },
        { "id": "num_fus_hours", "name": "send_after_hours", "type": "number", "required": true },
        { "id": "num_fus_mins", "name": "send_after_minutes", "type": "number", "required": true },
        { "id": "sel_fus_conv", "name": "conversation_type", "type": "select", "required": true, "values": ["last_sequence", "last_conversation", "last_merchant_msg", "last_customer_msg"], "maxSelect": 1 },
        { "id": "num_fus_order", "name": "order", "type": "number", "required": true }
      ]
    });
    app.save(sequences);
    console.log("Created follow_up_sequences collection");
  } catch (err) {
    console.log("Failed to create follow_up_sequences:", err.message || err);
  }

  // ── 3. follow_up_messages ──
  try {
    const seqCol = app.findCollectionByNameOrId("follow_up_sequences");
    const messages = new Collection({
      "name": "follow_up_messages",
      "type": "base",
      "system": false,
      "listRule": "sequence.group.merchant.owner = @request.auth.id",
      "viewRule": "sequence.group.merchant.owner = @request.auth.id",
      "createRule": "sequence.group.merchant.owner = @request.auth.id",
      "updateRule": "sequence.group.merchant.owner = @request.auth.id",
      "deleteRule": "sequence.group.merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text3208210256", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate2990389176", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate3332085495", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_fum_seq", "name": "sequence", "type": "relation", "required": true, "collectionId": seqCol.id, "maxSelect": 1, "cascadeDelete": true },
        { "id": "text_fum_body", "name": "message_body", "type": "text", "required": true },
        { "id": "file_fum_media", "name": "media_file", "type": "file", "required": false, "maxSelect": 1, "maxSize": 524288000 },
        { "id": "json_fum_btns", "name": "action_buttons", "type": "json", "required": false },
        { "id": "num_fum_order", "name": "order", "type": "number", "required": true }
      ]
    });
    app.save(messages);
    console.log("Created follow_up_messages collection");
  } catch (err) {
    console.log("Failed to create follow_up_messages:", err.message || err);
  }

  // ── 4. follow_up_members ──
  try {
    const groupsCol = app.findCollectionByNameOrId("follow_up_groups");
    const members = new Collection({
      "name": "follow_up_members",
      "type": "base",
      "system": false,
      "listRule": "customer = @request.auth.id || group.merchant.owner = @request.auth.id",
      "viewRule": "customer = @request.auth.id || group.merchant.owner = @request.auth.id",
      "createRule": "group.merchant.owner = @request.auth.id",
      "updateRule": "group.merchant.owner = @request.auth.id",
      "deleteRule": "group.merchant.owner = @request.auth.id",
      "options": {},
      "fields": [
        { "id": "text3208210256", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate2990389176", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate3332085495", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_fum_group", "name": "group", "type": "relation", "required": true, "collectionId": groupsCol.id, "maxSelect": 1, "cascadeDelete": true },
        { "id": "rel_fum_customer", "name": "customer", "type": "relation", "required": true, "collectionId": "_pb_users_auth_", "maxSelect": 1 },
        { "id": "date_fum_lastsent", "name": "last_message_sent_at", "type": "date", "required": false },
        { "id": "num_fum_seqdone", "name": "sequence_completed", "type": "number", "required": false },
        { "id": "sel_fum_status", "name": "status", "type": "select", "required": true, "values": ["enrolled", "in_progress", "completed", "unsubscribed"], "maxSelect": 1 }
      ]
    });
    app.save(members);
    console.log("Created follow_up_members collection");
  } catch (err) {
    console.log("Failed to create follow_up_members:", err.message || err);
  }

  // ── 5. follow_up_logs ──
  try {
    const groupsCol = app.findCollectionByNameOrId("follow_up_groups");
    const seqCol = app.findCollectionByNameOrId("follow_up_sequences");
    const memCol = app.findCollectionByNameOrId("follow_up_members");
    const logs = new Collection({
      "name": "follow_up_logs",
      "type": "base",
      "system": false,
      "listRule": "customer = @request.auth.id || group.merchant.owner = @request.auth.id",
      "viewRule": "customer = @request.auth.id || group.merchant.owner = @request.auth.id",
      "createRule": null,
      "updateRule": null,
      "deleteRule": null,
      "options": {},
      "fields": [
        { "id": "text3208210256", "name": "id", "type": "text", "system": true, "required": true, "primaryKey": true },
        { "id": "autodate2990389176", "name": "created", "type": "autodate", "system": true, "onCreate": true, "onUpdate": false },
        { "id": "autodate3332085495", "name": "updated", "type": "autodate", "system": true, "onCreate": true, "onUpdate": true },
        { "id": "rel_ful_group", "name": "group", "type": "relation", "required": true, "collectionId": groupsCol.id, "maxSelect": 1, "cascadeDelete": true },
        { "id": "rel_ful_seq", "name": "sequence", "type": "relation", "required": true, "collectionId": seqCol.id, "maxSelect": 1 },
        { "id": "rel_ful_member", "name": "member", "type": "relation", "required": true, "collectionId": memCol.id, "maxSelect": 1 },
        { "id": "rel_ful_customer", "name": "customer", "type": "relation", "required": true, "collectionId": "_pb_users_auth_", "maxSelect": 1 },
        { "id": "sel_ful_channel", "name": "channel", "type": "select", "required": true, "values": ["whatsapp", "push", "inapp"], "maxSelect": 1 },
        { "id": "sel_ful_status", "name": "status", "type": "select", "required": true, "values": ["sent", "failed", "delivered", "read"], "maxSelect": 1 },
        { "id": "text_ful_err", "name": "error_message", "type": "text", "required": false }
      ]
    });
    app.save(logs);
    console.log("Created follow_up_logs collection");
  } catch (err) {
    console.log("Failed to create follow_up_logs:", err.message || err);
  }
}, (app) => {
  // Rollback: delete all 5 collections
  const collections = ["follow_up_logs", "follow_up_members", "follow_up_messages", "follow_up_sequences", "follow_up_groups"];
  for (const name of collections) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (col) app.delete(col);
    } catch (e) {}
  }
});