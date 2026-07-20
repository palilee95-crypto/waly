/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    id: "pbc_bday_rewards",
    name: "birthday_rewards",
    type: "base",
    system: false,
    listRule: "merchant.owner = @request.auth.id",
    viewRule: "merchant.owner = @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "merchant.owner = @request.auth.id",
    deleteRule: "merchant.owner = @request.auth.id",
    options: {},
    fields: [
      { id: "id", name: "id", type: "text", system: true, required: true, primaryKey: true },
      { id: "created", name: "created", type: "autodate", system: true, onCreate: true, onUpdate: false },
      { id: "updated", name: "updated", type: "autodate", system: true, onCreate: true, onUpdate: true },
      {
        id: "rel_merchant",
        name: "merchant",
        type: "relation",
        required: true,
        collectionId: "pbc_merchants00",
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        id: "sel_reward_type",
        name: "reward_type",
        type: "select",
        required: true,
        values: ["voucher_code", "stamps", "discount_percent", "free_item"],
      },
      {
        id: "num_reward_value",
        name: "reward_value",
        type: "number",
        required: false,
        min: 0,
      },
      {
        id: "text_title",
        name: "title",
        type: "text",
        required: true,
      },
      {
        id: "text_description",
        name: "description",
        type: "text",
        required: false,
      },
      {
        id: "text_message_template",
        name: "message_template",
        type: "text",
        required: true,
      },
      {
        id: "text_template_b",
        name: "message_template_b",
        type: "text",
        required: false,
      },
      {
        id: "num_expiry_days",
        name: "expiry_days",
        type: "number",
        required: true,
        min: 1,
        max: 365,
      },
      {
        id: "text_send_time",
        name: "send_time",
        type: "text",
        required: true,
      },
      {
        id: "bool_is_active",
        name: "is_active",
        type: "bool",
        required: false,
      },
    ],
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_bday_rewards");
  return app.delete(collection);
});