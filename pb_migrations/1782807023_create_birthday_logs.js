/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    id: "pbc_bday_logs",
    name: "birthday_logs",
    type: "base",
    system: false,
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    options: {},
    fields: [
      { id: "id", name: "id", type: "text", system: true, required: true, primaryKey: true },
      { id: "created", name: "created", type: "autodate", system: true, onCreate: true, onUpdate: false },
      { id: "updated", name: "updated", type: "autodate", system: true, onCreate: true, onUpdate: true },
      {
        id: "rel_customer",
        name: "customer",
        type: "relation",
        required: true,
        collectionId: "_pb_users_auth_",
        maxSelect: 1,
      },
      {
        id: "rel_merchant",
        name: "merchant",
        type: "relation",
        required: true,
        collectionId: "pbc_merchants00",
        maxSelect: 1,
      },
      {
        id: "rel_reward",
        name: "reward",
        type: "relation",
        required: true,
        collectionId: "pbc_bday_rewards",
        maxSelect: 1,
      },
      {
        id: "rel_voucher",
        name: "voucher",
        type: "relation",
        required: false,
        collectionId: "pbc_vouchers0",
        maxSelect: 1,
      },
      {
        id: "num_year",
        name: "year",
        type: "number",
        required: true,
      },
      {
        id: "sel_status",
        name: "status",
        type: "select",
        required: true,
        values: ["pending", "sent", "failed", "redeemed"],
      },
      {
        id: "text_ab_group",
        name: "ab_group",
        type: "text",
        required: false,
      },
      {
        id: "text_error",
        name: "error_message",
        type: "text",
        required: false,
      },
    ],
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_bday_logs");
  return app.delete(collection);
});