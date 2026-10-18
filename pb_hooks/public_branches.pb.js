// pb_hooks/public_branches.pb.js
// Public, minimal-field outlet list for the customer booking PWA.

routerAdd("GET", "/api/risev/branches/public", (e) => {
  let q = {};
  try { q = e.requestInfo().query || {}; } catch (err) {}
  const merchantId = (q.merchant || q.m || "").trim();
  if (!merchantId) return e.json(400, { message: "merchant is required" });

  const out = [];
  try {
    const list = $app.findRecordsByFilter("branches",
      `merchant = '${merchantId}' && status = 'active'`, "-is_hq,-created", 100, 0);
    list.forEach(b => out.push({
      id: b.id,
      name: b.getString("name") || "",
      address: b.getString("address") || "",
      city: b.getString("city") || "",
      phone: b.getString("phone") || "",
      is_hq: b.getBool("is_hq"),
    }));
  } catch (err) {
    console.log("[PUBLIC BRANCHES ERROR]", err.message || err);
  }
  return e.json(200, { branches: out });
});
