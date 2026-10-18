/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let merchants = [];
  try { merchants = app.findRecordsByFilter("merchants", "1=1", "-created", 5000, 0); }
  catch (e) { console.log("[MIGRATION] merchants query:", e.message || e); return null; }

  let fixed = 0, promoted = 0;
  merchants.forEach(m => {
    try {
      const list = app.findRecordsByFilter("branches", `merchant = '${m.id}'`, "+created", 500, 0);
      if (list.length === 0) return;
      const hqs = list.filter(b => b.getBool("is_hq"));
      if (hqs.length > 1) {
        for (let i = 1; i < hqs.length; i++) { hqs[i].set("is_hq", false); app.save(hqs[i]); fixed++; }
      } else if (hqs.length === 0) {
        list[0].set("is_hq", true); app.save(list[0]); promoted++;
      }
    } catch (e) {}
  });
  console.log(`[MIGRATION] HQ normalized: demoted ${fixed}, promoted ${promoted}`);
  return null;
}, (app) => { return null; });
