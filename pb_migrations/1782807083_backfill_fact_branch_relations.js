/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  function recStr(rec, name) { try { return rec.getString(name) || ""; } catch (e) { return ""; } }

  function hqFor(merchantId) {
    try {
      const hq = app.findRecordsByFilter("branches",
        `merchant = '${merchantId}' && is_hq = true`, "-created", 1, 0);
      if (hq.length > 0) return hq[0].id;
      const any = app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 1, 0);
      if (any.length > 0) return any[0].id;
    } catch (e) {}
    return "";
  }
  function branchById(merchantId, id) {
    if (!id) return "";
    try {
      const b = app.findRecordById("branches", id);
      if (b && recStr(b, "merchant") === merchantId) return b.id;
    } catch (e) {}
    return "";
  }
  function branchByName(merchantId, name) {
    const t = (name || "").trim().toLowerCase();
    if (!t) return "";
    try {
      const list = app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 500, 0);
      for (let i = 0; i < list.length; i++) {
        if ((recStr(list[i], "name")).trim().toLowerCase() === t) return list[i].id;
      }
    } catch (e) {}
    return "";
  }
  function meta(rec) {
    try {
      const raw = rec.get("metadata");
      if (typeof raw === "string" && raw.trim()) return JSON.parse(raw);
      if (raw && typeof raw === "object") return raw;
    } catch (e) {}
    return {};
  }

  function backfill(collection, merchantField) {
    let rows = [];
    try { rows = app.findRecordsByFilter(collection, "1=1", "-created", 20000, 0); }
    catch (e) { console.log(`[MIGRATION] ${collection} query:`, e.message || e); return; }
    let n = 0;
    rows.forEach(r => {
      try {
        if (recStr(r, "branch")) return;
        let mid = recStr(r, merchantField);
        if (!mid && recStr(r, "reward")) {
          try { mid = app.findRecordById("rewards", recStr(r, "reward")).getString("merchant"); } catch (e) {}
        }
        if (!mid) return;
        const m = meta(r);
        let bid = branchById(mid, m.branch_id || "") || branchByName(mid, m.branch_name || "");
        if (!bid) bid = branchByName(mid, recStr(r, "branch_name"));
        if (!bid) bid = hqFor(mid);
        if (bid) { r.set("branch", bid); app.save(r); n++; }
      } catch (e) {}
    });
    console.log(`[MIGRATION] Backfilled ${collection}.branch on ${n} rows`);
  }

  backfill("transactions", "merchant");
  backfill("vouchers", "merchant");
  backfill("redemptions", "merchant");
  backfill("nfc_claims", "merchant");
  return null;
}, (app) => { return null; });
