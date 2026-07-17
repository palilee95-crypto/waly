/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // ── 1. follow_up_groups ──
  const groups = new Collection({
    name: "follow_up_groups",
    type: "base",
    listRule: "merchant.owner = @request.auth.id",
    viewRule: "merchant.owner = @request.auth.id",
    createRule: "merchant.owner = @request.auth.id",
    updateRule: "merchant.owner = @request.auth.id",
    deleteRule: "merchant.owner = @request.auth.id",
    fields: [
      { name: "id", type: "text", required: true, autogeneratePattern: "[a-z0-9]{15}" },
      { name: "merchant", type: "relation", required: true, options: { collectionId: "pbc_merchants00", maxSelect: 1, cascadeDelete: false } },
      { name: "name", type: "text", required: true },
      { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["draft", "active", "paused", "archived"] } },
      { name: "archive_after_send", type: "bool", required: false },
      { name: "interval_minutes", type: "number", required: false },
      { name: "member_count", type: "number", required: false },
      { name: "sequence_count", type: "number", required: false },
    ],
  });
  app.save(groups);

  // ── 2. follow_up_sequences ──
  const sequences = new Collection({
    name: "follow_up_sequences",
    type: "base",
    listRule: "group.merchant.owner = @request.auth.id",
    viewRule: "group.merchant.owner = @request.auth.id",
    createRule: "group.merchant.owner = @request.auth.id",
    updateRule: "group.merchant.owner = @request.auth.id",
    deleteRule: "group.merchant.owner = @request.auth.id",
    fields: [
      { name: "id", type: "text", required: true, autogeneratePattern: "[a-z0-9]{15}" },
      { name: "group", type: "relation", required: true, options: { collectionId: groups.id, maxSelect: 1, cascadeDelete: true } },
      { name: "title", type: "text", required: true },
      { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["active", "inactive"] } },
      { name: "send_after_days", type: "number", required: true },
      { name: "send_after_hours", type: "number", required: true },
      { name: "send_after_minutes", type: "number", required: true },
      { name: "conversation_type", type: "select", required: true, options: { maxSelect: 1, values: ["last_sequence", "last_conversation", "last_merchant_msg", "last_customer_msg"] } },
      { name: "order", type: "number", required: true },
    ],
  });
  app.save(sequences);

  // ── 3. follow_up_messages ──
  const messages = new Collection({
    name: "follow_up_messages",
    type: "base",
    listRule: "sequence.group.merchant.owner = @request.auth.id",
    viewRule: "sequence.group.merchant.owner = @request.auth.id",
    createRule: "sequence.group.merchant.owner = @request.auth.id",
    updateRule: "sequence.group.merchant.owner = @request.auth.id",
    deleteRule: "sequence.group.merchant.owner = @request.auth.id",
    fields: [
      { name: "id", type: "text", required: true, autogeneratePattern: "[a-z0-9]{15}" },
      { name: "sequence", type: "relation", required: true, options: { collectionId: sequences.id, maxSelect: 1, cascadeDelete: true } },
      { name: "message_body", type: "text", required: true },
      { name: "media_file", type: "file", required: false, options: { maxSelect: 1, maxSize: 524288000 } },
      { name: "action_buttons", type: "json", required: false },
      { name: "order", type: "number", required: true },
    ],
  });
  app.save(messages);

  // ── 4. follow_up_members ──
  const members = new Collection({
    name: "follow_up_members",
    type: "base",
    listRule: "customer = @request.auth.id || group.merchant.owner = @request.auth.id",
    viewRule: "customer = @request.auth.id || group.merchant.owner = @request.auth.id",
    createRule: "group.merchant.owner = @request.auth.id",
    updateRule: "group.merchant.owner = @request.auth.id",
    deleteRule: "group.merchant.owner = @request.auth.id",
    fields: [
      { name: "id", type: "text", required: true, autogeneratePattern: "[a-z0-9]{15}" },
      { name: "group", type: "relation", required: true, options: { collectionId: groups.id, maxSelect: 1, cascadeDelete: true } },
      { name: "customer", type: "relation", required: true, options: { collectionId: "_pb_users_auth_", maxSelect: 1, cascadeDelete: false } },
      { name: "enrolled_at", type: "autodate", required: false, options: { onCreate: true, onUpdate: false } },
      { name: "last_message_sent_at", type: "date", required: false },
      { name: "sequence_completed", type: "number", required: false },
      { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["enrolled", "in_progress", "completed", "unsubscribed"] } },
    ],
  });
  app.save(members);

  // ── 5. follow_up_logs ──
  const logs = new Collection({
    name: "follow_up_logs",
    type: "base",
    listRule: "customer = @request.auth.id || group.merchant.owner = @request.auth.id",
    viewRule: "customer = @request.auth.id || group.merchant.owner = @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "id", type: "text", required: true, autogeneratePattern: "[a-z0-9]{15}" },
      { name: "group", type: "relation", required: true, options: { collectionId: groups.id, maxSelect: 1, cascadeDelete: true } },
      { name: "sequence", type: "relation", required: true, options: { collectionId: sequences.id, maxSelect: 1, cascadeDelete: false } },
      { name: "member", type: "relation", required: true, options: { collectionId: members.id, maxSelect: 1, cascadeDelete: false } },
      { name: "customer", type: "relation", required: true, options: { collectionId: "_pb_users_auth_", maxSelect: 1, cascadeDelete: false } },
      { name: "sent_at", type: "autodate", required: false, options: { onCreate: true, onUpdate: false } },
      { name: "channel", type: "select", required: true, options: { maxSelect: 1, values: ["whatsapp", "push", "inapp"] } },
      { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["sent", "failed", "delivered", "read"] } },
      { name: "error_message", type: "text", required: false },
    ],
  });
  app.save(logs);

  return app;
}, (app) => {
  // Rollback: delete all 5 collections
  const collections = ["follow_up_logs", "follow_up_members", "follow_up_messages", "follow_up_sequences", "follow_up_groups"];
  for (const name of collections) {
    const col = app.findCollectionByNameOrId(name);
    app.delete(col);
  }
  return app;
});
