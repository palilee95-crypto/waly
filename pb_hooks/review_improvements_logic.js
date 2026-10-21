// Review improvement tasks are merchant-owned work records. Source feedback is
// deliberately never written by these helpers.

function ownerMerchant($app, auth) {
  if (!auth) return null;
  let merchantId = "";
  try { merchantId = auth.getString("merchant_id") || ""; } catch (err) {}
  if (merchantId) {
    try {
      const merchant = $app.findRecordById("merchants", merchantId);
      if (merchant.getString("owner") === auth.id) return merchant;
    } catch (err) {}
  }
  try {
    const owned = $app.findRecordsByFilter("merchants", "owner = '" + auth.id + "'", "", 1, 0);
    return owned && owned.length ? owned[0] : null;
  } catch (err) { return null; }
}

function taskFromRecord(task, review) {
  return {
    id: task.id,
    reviewId: task.getString("review"),
    title: task.getString("title"),
    category: task.getString("category"),
    status: task.getString("status"),
    ownerName: task.getString("owner_name") || "Store team",
    dueDate: task.getString("due_date") || "",
    note: task.getString("note") || "",
    createdAt: task.getString("created"),
    updatedAt: task.getString("updated"),
    review: review ? {
      stars: review.getInt("rating"),
      name: review.getString("customer_name") || "Customer",
      feedback: review.getString("feedback") || "",
      createdAt: review.getString("created"),
    } : null,
  };
}

function listTasks($app, merchantId) {
  const records = $app.findRecordsByFilter(
    "review_improvement_tasks", "merchant = '" + merchantId + "'", "-updated", 500, 0
  );
  const tasks = records.map(function (task) {
    let review = null;
    try { review = $app.findRecordById("store_feedbacks", task.getString("review")); } catch (err) {}
    return taskFromRecord(task, review && review.getString("merchant") === merchantId ? review : null);
  });
  const counts = { open: 0, in_progress: 0, done: 0 };
  tasks.forEach(function (task) {
    if (Object.prototype.hasOwnProperty.call(counts, task.status)) counts[task.status]++;
  });
  return { items: tasks, counts: counts, limit: 500, truncated: records.length === 500, allPeriods: true };
}

function createTask($app, merchantId, input) {
  const reviewId = String(input.reviewId || "").trim();
  const title = String(input.title || "").trim();
  const category = String(input.category || "other");
  const ownerName = String(input.ownerName || "Store team").trim();
  const dueDate = String(input.dueDate || "").trim();
  const note = String(input.note || "").trim();
  if (!reviewId || !title || title.length > 120) return { error: "Give this improvement a title (up to 120 characters)." };
  if (["service", "product", "wait", "staff", "other"].indexOf(category) < 0) return { error: "Choose a valid category." };
  if (ownerName.length > 80 || note.length > 1000) return { error: "Owner or note is too long." };
  if (dueDate) {
    const parsedDue = new Date(dueDate + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || isNaN(parsedDue.getTime()) || parsedDue.toISOString().slice(0, 10) !== dueDate) {
      return { error: "Due date must be a valid YYYY-MM-DD date." };
    }
  }
  let review = null;
  try { review = $app.findRecordById("store_feedbacks", reviewId); } catch (err) {}
  if (!review || review.getString("merchant") !== merchantId) return { error: "Review not found for this merchant.", notFound: true };

  const collection = $app.findCollectionByNameOrId("review_improvement_tasks");
  const task = new Record(collection);
  task.set("merchant", merchantId);
  task.set("review", reviewId);
  task.set("title", title);
  task.set("category", category);
  task.set("status", "open");
  task.set("owner_name", ownerName || "Store team");
  task.set("due_date", dueDate);
  task.set("note", note);
  $app.save(task);
  return { item: taskFromRecord(task, review) };
}

function updateStatus($app, merchantId, input) {
  const id = String(input.id || "").trim();
  const status = String(input.status || "");
  if (["open", "in_progress", "done"].indexOf(status) < 0) return { error: "Choose a valid task status." };
  let task = null;
  try { task = $app.findRecordById("review_improvement_tasks", id); } catch (err) {}
  if (!task || task.getString("merchant") !== merchantId) return { error: "Improvement task not found.", notFound: true };
  task.set("status", status);
  $app.save(task);
  let review = null;
  try { review = $app.findRecordById("store_feedbacks", task.getString("review")); } catch (err) {}
  return { item: taskFromRecord(task, review && review.getString("merchant") === merchantId ? review : null) };
}

module.exports = { ownerMerchant, listTasks, createTask, updateStatus };
