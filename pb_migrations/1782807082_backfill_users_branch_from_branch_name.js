/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let users = [];
  try {
    users = app.findRecordsByFilter("users", "merchant_id != '' && branch_name != ''", "-created", 5000, 0);
  } catch (e) { console.log("[MIGRATION] users query:", e.message || e); }

  function hqFor(merchantId) {
    try {
      const hq = app.findRecordsByFilter("branches",
        `merchant = '${merchantId}' && is_hq = true`, "-created", 1, 0);
      if (hq.length > 0) return hq[0].id;
    } catch (e) {}
    return "";
  }

  function branchByName(merchantId, name) {
    try {
      const target = (name || "").trim().toLowerCase();
      const list = app.findRecordsByFilter("branches", `merchant = '${merchantId}'`, "-created", 500, 0);
      for (let i = 0; i < list.length; i++) {
        if ((list[i].getString("name") || "").trim().toLowerCase() === target) return list[i].id;
      }
    } catch (e) {}
    return "";
  }

  let n = 0;
  users.forEach(u => {
    try {
      if (u.getString("branch")) return; // already set
      const mid = u.getString("merchant_id");
      const rawName = u.getString("branch_name") || "";
      let bid = "";
      if (rawName && rawName.toLowerCase().indexOf("all branches") === -1) {
        bid = branchByName(mid, rawName);
      }
      if (!bid) bid = hqFor(mid);
      if (bid) { u.set("branch", bid); app.save(u); n++; }
    } catch (e) {}
  });
  console.log(`[MIGRATION] Backfilled users.branch on ${n} users`);
  return null;
}, (app) => {
  try {
    const users = app.findRecordsByFilter("users", "branch != ''", "-created", 5000, 0);
    users.forEach(u => { try { u.set("branch", ""); app.save(u); } catch (e) {} });
  } catch (e) {}
  return null;
});
