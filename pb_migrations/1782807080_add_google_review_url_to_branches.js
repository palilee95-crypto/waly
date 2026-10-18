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

  // Backfill: the URL lives on the merchant; copy it to the HQ outlet.
  try {
    const hqs = app.findRecordsByFilter("branches", "is_hq = true", "-created", 5000, 0);
    let n = 0;
    hqs.forEach(b => {
      try {
        if (b.getString("google_review_url")) return;
        const m = app.findRecordById("merchants", b.getString("merchant"));
        const url = m.getString("google_review_url") || "";
        if (url) { b.set("google_review_url", url); app.save(b); n++; }
      } catch (e) {}
    });
    console.log(`[MIGRATION] Backfilled google_review_url on ${n} HQ outlets`);
  } catch (e2) {}
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    col.fields.removeByName("google_review_url");
    app.save(col);
  } catch (e) {}
  return null;
});
