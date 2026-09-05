// pb_hooks/pricing_admin.pb.js
// Dedicated API route for Admin Portal to update pricing models (Pro Plan & NFC Hardware)

routerAdd("POST", "/api/risev/admin/pricing-settings", (c) => {
  let authRecord = c.auth || null;
  if (!authRecord && typeof c.get === "function") {
    try { authRecord = c.get("authRecord"); } catch (e) {}
  }
  if (!authRecord && c.httpContext) {
    try { authRecord = c.httpContext.get("authRecord"); } catch (e) {}
  }

  if (!authRecord) {
    let authHeader = "";
    try {
      if (c.requestInfo && c.requestInfo().headers) {
        authHeader = c.requestInfo().headers["authorization"] || "";
      }
    } catch (e) {}
    if (!authHeader) {
      try { authHeader = c.request().header.get("Authorization") || ""; } catch (e) {}
    }
    if (authHeader) {
      const parts = authHeader.split(" ");
      const token = parts.length === 2 ? parts[1] : parts[0];
      if (token) {
        try {
          authRecord = $app.findAuthRecordByToken(token, $app.settings().recordAuthToken.secret);
        } catch (tokErr) {
          try { authRecord = $app.findAuthRecordByToken(token); } catch (tokErr2) {}
        }
      }
    }
  }

  if (!authRecord) {
    return c.json(401, { success: false, message: "Authentication required." });
  }

  const isSuperuser = (authRecord.isSuperuser === true) || 
                      (authRecord.collection && authRecord.collection().name === "_superusers") ||
                      (authRecord.getString && authRecord.getString("role") === "admin");

  if (!isSuperuser) {
    return c.json(403, { success: false, message: "Forbidden. Admin/Superuser access required." });
  }

  let body = {};
  try {
    body = c.requestInfo().body || {};
  } catch (e) {
    try {
      body = $apis.requestInfo(c).data || {};
    } catch (f) {
      body = {};
    }
  }

  const id = body.id || "pricesettings02";
  const settingsCol = $app.findCollectionByNameOrId("pricing_settings");

  let record = null;
  try {
    record = $app.findRecordById("pricing_settings", id);
  } catch (err) {}

  if (!record) {
    record = new Record(settingsCol);
    record.set("id", id);
  }

  if (body.base_price_1m !== undefined) record.set("base_price_1m", Number(body.base_price_1m));
  if (body.discount_3m !== undefined) record.set("discount_3m", Number(body.discount_3m));
  if (body.discount_6m !== undefined) record.set("discount_6m", Number(body.discount_6m));
  if (body.discount_9m !== undefined) record.set("discount_9m", Number(body.discount_9m) || 12);
  if (body.discount_12m !== undefined) record.set("discount_12m", Number(body.discount_12m) || 15);
  
  if (body.enable_3m !== undefined) record.set("enable_3m", !!body.enable_3m);
  if (body.enable_6m !== undefined) record.set("enable_6m", !!body.enable_6m);
  if (body.enable_9m !== undefined) record.set("enable_9m", !!body.enable_9m);
  if (body.enable_12m !== undefined) record.set("enable_12m", !!body.enable_12m);

  try {
    $app.save(record);
    console.log(`[PRICING SETTINGS UPDATED] Saved ${id} successfully.`);
    return c.json(200, { success: true, message: `Pricing settings ${id} updated successfully`, data: record });
  } catch (saveErr) {
    console.log(`[PRICING SETTINGS ERROR] Failed to save ${id}:`, saveErr.message || saveErr);
    return c.json(500, { success: false, message: saveErr.message || "Failed to save pricing settings" });
  }
});
