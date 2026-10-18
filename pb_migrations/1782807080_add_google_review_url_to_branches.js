/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    let has = false;
    try { if (col.fields.getByName("google_review_url")) has = true; } catch (e) {}
    if (!has) {
      col.fields.add(new Field({
        id: "text_gr_url_br",
        name: "google_review_url",
        type: "text",
        system: false,
        required: false,
        presentable: false,
      }));
      app.save(col);
      console.log("[MIGRATION] Added branches.google_review_url");
    }
  } catch (err) {
    console.log("[MIGRATION] branches.google_review_url:", err.message || err);
  }
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    col.fields.removeByName("google_review_url");
    app.save(col);
  } catch (e) {}
  return null;
});
