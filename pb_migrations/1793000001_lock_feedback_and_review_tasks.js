/// <reference path="../pb_data/types.d.ts" />
// Merchants may read customer feedback, but cannot rewrite or remove it through
// the collection API. Their improvement work is stored in a separate collection.
migrate((app) => {
  const feedback = app.findCollectionByNameOrId("store_feedbacks");
  feedback.updateRule = null;
  feedback.deleteRule = null;
  app.save(feedback);

  const merchant = app.findCollectionByNameOrId("merchants");
  try {
    app.findCollectionByNameOrId("review_improvement_tasks");
    return;
  } catch (err) {}

  app.save(new Collection({
    name: "review_improvement_tasks",
    type: "base",
    system: false,
    // All task writes go through owner-checked routes. Superusers retain
    // moderation access, while ordinary collection API clients have none.
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "merchant", type: "relation", required: true, collectionId: merchant.id, maxSelect: 1 },
      { name: "review", type: "relation", required: true, collectionId: feedback.id, maxSelect: 1, cascadeDelete: false },
      { name: "title", type: "text", required: true, max: 120 },
      { name: "category", type: "select", required: true, values: ["service", "product", "wait", "staff", "other"], maxSelect: 1 },
      { name: "status", type: "select", required: true, values: ["open", "in_progress", "done"], maxSelect: 1 },
      { name: "owner_name", type: "text", max: 80 },
      { name: "due_date", type: "text", max: 10 },
      { name: "note", type: "text", max: 1000 },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_review_tasks_merchant_updated ON review_improvement_tasks (merchant, updated)",
      "CREATE INDEX idx_review_tasks_review ON review_improvement_tasks (review)",
    ],
  }));
}, (app) => {
  // Rolling this migration back would reopen merchant edit/delete access to
  // source feedback and discard task history. Preserve both for an explicit
  // retention/migration decision instead.
  throw new Error("Feedback protection and improvement tasks require an explicit rollback plan.");
});
