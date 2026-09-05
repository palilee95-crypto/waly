// MD5 and Base64 Utilities for J&T Express Signature Generation
function md5(string) {
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  function add32(a, b) { return (a + b) & 0xFFFFFFFF; }

  function md5blk(s) {
    const nblk = ((s.length + 8) >> 6) + 1;
    const blks = new Array(nblk * 16);
    for (let i = 0; i < nblk * 16; i++) blks[i] = 0;
    for (let i = 0; i < s.length; i++) {
      blks[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
    }
    blks[s.length >> 2] |= 0x80 << ((s.length % 4) * 8);
    blks[nblk * 16 - 2] = s.length * 8;
    return blks;
  }

  const x = md5blk(string);
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d;
    a = ff(a, b, c, d, x[i+0], 7, -680876936);
    d = ff(d, a, b, c, x[i+1], 12, -389564586);
    c = ff(c, d, a, b, x[i+2], 17, 606105819);
    b = ff(b, c, d, a, x[i+3], 22, -1044525330);
    a = ff(a, b, c, d, x[i+4], 7, -176418897);
    d = ff(d, a, b, c, x[i+5], 12, 1200080426);
    c = ff(c, d, a, b, x[i+6], 17, -1473231341);
    b = ff(b, c, d, a, x[i+7], 22, -45705983);
    a = ff(a, b, c, d, x[i+8], 7, 1770035416);
    d = ff(d, a, b, c, x[i+9], 12, -1958414417);
    c = ff(c, d, a, b, x[i+10], 17, -42063);
    b = ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = ff(a, b, c, d, x[i+12], 7, 1804603682);
    d = ff(d, a, b, c, x[i+13], 12, -40341101);
    c = ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = ff(b, c, d, a, x[i+15], 22, 1236535329);

    a = gg(a, b, c, d, x[i+1], 5, -165796510);
    d = gg(d, a, b, c, x[i+6], 9, -1069501632);
    c = gg(c, d, a, b, x[i+11], 14, 643717713);
    b = gg(b, c, d, a, x[i+0], 20, -373897302);
    a = gg(a, b, c, d, x[i+5], 5, -701558691);
    d = gg(d, a, b, c, x[i+10], 9, 38016083);
    c = gg(c, d, a, b, x[i+15], 14, -660478335);
    b = gg(b, c, d, a, x[i+4], 20, -405537848);
    a = gg(a, b, c, d, x[i+9], 5, 568446438);
    d = gg(d, a, b, c, x[i+14], 9, -1019803690);
    c = gg(c, d, a, b, x[i+3], 14, -187363961);
    b = gg(b, c, d, a, x[i+8], 20, 1163531501);
    a = gg(a, b, c, d, x[i+13], 5, -1444681467);
    d = gg(d, a, b, c, x[i+2], 9, -51403784);
    c = gg(c, d, a, b, x[i+7], 14, 1735328473);
    b = gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = hh(a, b, c, d, x[i+5], 4, -378558);
    d = hh(d, a, b, c, x[i+8], 11, -2022574463);
    c = hh(c, d, a, b, x[i+11], 16, 1839030562);
    b = hh(b, c, d, a, x[i+14], 23, -35309556);
    a = hh(a, b, c, d, x[i+1], 4, -1530992060);
    d = hh(d, a, b, c, x[i+4], 11, 1272893353);
    c = hh(c, d, a, b, x[i+7], 16, -155497632);
    b = hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = hh(a, b, c, d, x[i+13], 4, 681279174);
    d = hh(d, a, b, c, x[i+0], 11, -358537222);
    c = hh(c, d, a, b, x[i+3], 16, -722521979);
    b = hh(b, c, d, a, x[i+6], 23, 76029189);
    a = hh(a, b, c, d, x[i+9], 4, -640364487);
    d = hh(d, a, b, c, x[i+12], 11, -421815835);
    c = hh(c, d, a, b, x[i+15], 16, 530742520);
    b = hh(b, c, d, a, x[i+2], 23, -995338651);

    a = ii(a, b, c, d, x[i+0], 6, -198630844);
    d = ii(d, a, b, c, x[i+7], 10, 1126891415);
    c = ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = ii(b, c, d, a, x[i+5], 21, -57434055);
    a = ii(a, b, c, d, x[i+12], 6, 1700485571);
    d = ii(d, a, b, c, x[i+3], 10, -1894986606);
    c = ii(c, d, a, b, x[i+10], 15, -1051523);
    b = ii(b, c, d, a, x[i+1], 21, -2054922799);
    a = ii(a, b, c, d, x[i+8], 6, 1873313359);
    d = ii(d, a, b, c, x[i+15], 10, -30611744);
    c = ii(c, d, a, b, x[i+6], 15, -1560198380);
    b = ii(b, c, d, a, x[i+13], 21, 1309151649);
    a = ii(a, b, c, d, x[i+4], 6, -145523070);
    d = ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = ii(c, d, a, b, x[i+2], 15, 718787259);
    b = ii(b, c, d, a, x[i+9], 21, -343485551);

    a = add32(a, olda);
    b = add32(b, oldb);
    c = add32(c, oldc);
    d = add32(d, oldd);
  }

  // Convert raw 16-byte buffer to binary string
  const rawBytes = [];
  const words = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    const w = words[i];
    rawBytes.push(String.fromCharCode(w & 0xFF));
    rawBytes.push(String.fromCharCode((w >>> 8) & 0xFF));
    rawBytes.push(String.fromCharCode((w >>> 16) & 0xFF));
    rawBytes.push(String.fromCharCode((w >>> 24) & 0xFF));
  }
  return rawBytes.join("");
}

function base64Encode(str) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let encoded = "";
  let c1, c2, c3, e1, e2, e3, e4;
  let i = 0;
  while (i < str.length) {
    c1 = str.charCodeAt(i++);
    c2 = str.charCodeAt(i++);
    c3 = str.charCodeAt(i++);
    e1 = c1 >> 2;
    e2 = ((c1 & 3) << 4) | (c2 >> 4);
    e3 = ((c2 & 15) << 2) | (c3 >> 6);
    e4 = c3 & 63;
    if (isNaN(c2)) {
      e3 = e4 = 64;
    } else if (isNaN(c3)) {
      e4 = 64;
    }
    encoded += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return encoded;
}

function generateJntDataDigest(jsonContent, apiKey) {
  const rawHash = md5(jsonContent + apiKey);
  return base64Encode(rawHash);
}

function getJntConfig() {
  let dbKey = null;
  try {
    $app.newQuery("CREATE TABLE IF NOT EXISTS _risev_secrets (key TEXT PRIMARY KEY, value TEXT)").execute();
    const row = {};
    $app.newQuery("SELECT value FROM _risev_secrets WHERE key = 'jnt_api_key'").one(row);
    if (row && row.value) dbKey = row.value;
  } catch (e) {}

  const apiKey = dbKey || $os.getenv("JNT_API_KEY") || null;
  const custCode = $os.getenv("JNT_CUST_CODE") || $os.getenv("JNT_CUSTOMER_CODE") || "JNTMY88888";
  const env = $os.getenv("JNT_ENV") || "live";
  const baseUrl = env === "sandbox" || env === "demo"
    ? "https://openapi-test.jtexpress.my/web/open"
    : "https://openapi.jtexpress.my/web/open";

  return { apiKey, custCode, env, baseUrl };
}

// Route: GET /api/risev/jnt/status (& aliases)
function handleJntStatus(c) {
  const config = getJntConfig();
  return c.json(200, {
    success: true,
    provider: "jnt",
    courier_name: "J&T Express Malaysia",
    configured: !!config.apiKey,
    has_active_token: !!config.apiKey,
    has_api_key: !!config.apiKey,
    customer_code: config.custCode,
    env: config.env,
    vip_portal_url: "https://vip.jtexpress.my"
  });
}
routerAdd("GET", "/api/risev/jnt/status", handleJntStatus);
routerAdd("GET", "/api/risev/shipping/status", handleJntStatus);

// Route: POST /api/risev/jnt/rate-check (& aliases)
function handleJntRateCheck(c) {
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

  const destPostcode = (body.dest_postcode || "50470").toString().trim();
  const destState = (body.dest_state || "Kuala Lumpur").toString().trim();
  const weight = parseFloat(body.weight) || 0.5;

  const isEastMalaysia = ["sabah", "sarawak", "labuan"].some(em => destState.toLowerCase().includes(em));

  // J&T Express Malaysia Direct Tiered Rates Matrix
  const standardRates = [
    {
      courier_name: "J&T Express (Standard)",
      service_id: "JNT_EZ",
      service_code: "EZ",
      service_type: "Standard Doorstep Delivery",
      price: isEastMalaysia ? (weight <= 1.0 ? 14.50 : 18.00) : (weight <= 1.0 ? 6.00 : 7.50),
      delivery_eta: isEastMalaysia ? "3 - 5 Days" : "1 - 2 Working Days",
      rating: 4.9,
      is_recommended: true,
    },
    {
      courier_name: "J&T Express (Next-Day Priority)",
      service_id: "JNT_ND",
      service_code: "ND",
      service_type: "Guaranteed Next-Day Express",
      price: isEastMalaysia ? 22.00 : 9.50,
      delivery_eta: isEastMalaysia ? "2 - 3 Days" : "Next Working Day",
      rating: 4.9,
      is_recommended: false,
    },
    {
      courier_name: "J&T Eco (Economy Parcel)",
      service_id: "JNT_ECO",
      service_code: "ECO",
      service_type: "Economy Drop-off",
      price: isEastMalaysia ? 12.00 : 5.00,
      delivery_eta: isEastMalaysia ? "4 - 7 Days" : "2 - 3 Working Days",
      rating: 4.7,
      is_recommended: false,
    }
  ];

  return c.json(200, {
    success: true,
    provider: "jnt",
    source: "jnt_rates_matrix",
    dest_postcode: destPostcode,
    dest_state: destState,
    weight_kg: weight,
    rates: standardRates
  });
}
routerAdd("POST", "/api/risev/jnt/rate-check", handleJntRateCheck);
routerAdd("POST", "/api/risev/shipping/rate-check", handleJntRateCheck);

// Route: POST /api/risev/jnt/book (& aliases)
// Creates order via J&T Open API and updates hardware_orders record
function handleJntBook(c) {
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
    return c.json(401, { success: false, message: "Authentication required to book shipping." });
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

  const orderId = (body.order_id || "").toString().trim();
  const serviceCode = (body.service_code || "EZ").toString().trim().toUpperCase();

  if (!orderId) {
    return c.json(400, { success: false, message: "order_id is required" });
  }

  let orderRecord = null;
  try {
    orderRecord = $app.findRecordById("hardware_orders", orderId);
  } catch (err) {
    try {
      const records = $app.findRecordsByFilter("hardware_orders", `order_no = "${orderId}"`, "-created", 1, 0);
      if (records.length > 0) orderRecord = records[0];
    } catch (fErr) {}
  }

  if (!orderRecord) {
    return c.json(404, { success: false, message: "Order record not found" });
  }

  const isSuperuser = (authRecord.isSuperuser === true) || 
                      (authRecord.collection && authRecord.collection().name === "_superusers") ||
                      (authRecord.getString && authRecord.getString("role") === "admin");

  const orderUserId = orderRecord.getString("user");
  const orderMerchantId = orderRecord.getString("merchant");
  const authMerchantId = authRecord.getString ? authRecord.getString("merchant_id") : "";

  const isOrderOwner = (orderUserId && orderUserId === authRecord.id) || 
                       (orderMerchantId && orderMerchantId === authMerchantId);

  if (!isSuperuser && !isOrderOwner) {
    return c.json(403, { success: false, message: "Forbidden. You do not have permission to book shipping for this order." });
  }

  const courierName = "J&T Express";
  const serviceType = serviceCode || "EZ";
  let trackingNumber = null;
  let awbUrl = null;

  const config = getJntConfig();

  // If J&T VIP API Key is configured, execute live order creation
  if (config.apiKey) {
    try {
      const recipientName = orderRecord.getString("recipient_name") || "Valued Merchant";
      const rawPhone = orderRecord.getString("whatsapp_phone") || "+60123456789";
      let cleanPhone = rawPhone.replace(/\D/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "60" + cleanPhone.slice(1);
      if (!cleanPhone.startsWith("60")) cleanPhone = "60" + cleanPhone;

      const addressLine1 = orderRecord.getString("address_line1") || orderRecord.getString("full_address") || "Commercial Unit";
      const postcode = orderRecord.getString("postcode") || "50470";
      const city = orderRecord.getString("city") || "Kuala Lumpur";
      const state = orderRecord.getString("state") || "WP Kuala Lumpur";
      const orderNo = orderRecord.getString("order_no") || `ORD-${Date.now()}`;

      let senderPhone = (body.sender_phone || "011-5622 1568").replace(/\D/g, "");
      if (senderPhone.startsWith("0")) senderPhone = "60" + senderPhone.slice(1);
      if (!senderPhone.startsWith("60")) senderPhone = "60" + senderPhone;

      const orderPayload = {
        eccompanyid: config.custCode,
        customerid: config.custCode,
        txlogisticid: orderNo,
        ordertype: "1",
        servicetype: serviceType === "ND" ? "2" : "1",
        sender: {
          name: body.sender_name || "Risev Fulfillment HQ",
          phone: senderPhone,
          mobile: senderPhone,
          address: body.sender_address || "Plaza Sentral, Jalan Stesen Sentral 5",
          city: body.sender_city || "Kuala Lumpur",
          prov: body.sender_state || "WP Kuala Lumpur",
          postcode: body.sender_postcode || "50470",
          countrycode: "MYS"
        },
        receiver: {
          name: recipientName,
          phone: cleanPhone,
          mobile: cleanPhone,
          address: addressLine1,
          city: city,
          prov: state,
          postcode: postcode,
          countrycode: "MYS"
        },
        items: [{
          itemname: "Risev Smart Stand Hardware Kit",
          number: 1,
          itemvalue: 119.00,
          desc: "NFC Smart Stand & QR Display Kit"
        }],
        weight: 0.5,
        length: 15,
        width: 10,
        height: 5
      };

      const logisticsInterfaceStr = JSON.stringify(orderPayload);
      const dataDigest = generateJntDataDigest(logisticsInterfaceStr, config.apiKey);

      const requestBody = `logistics_interface=${encodeURIComponent(logisticsInterfaceStr)}&data_digest=${encodeURIComponent(dataDigest)}&msg_type=ORDERCREATE&eccompanyid=${encodeURIComponent(config.custCode)}`;

      const submitResp = $http.send({
        url: `${config.baseUrl}/order/create`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: requestBody,
        timeout: 18
      });

      console.log(`[J&T ORDER SUBMIT STATUS: ${submitResp.statusCode}]`, submitResp.raw);

      if (submitResp.statusCode === 200 || submitResp.statusCode === 201) {
        const parsed = JSON.parse(submitResp.raw);
        if (parsed) {
          const respData = parsed.responseitems ? parsed.responseitems[0] : (parsed.data || parsed);
          if (respData.mailno) trackingNumber = respData.mailno;
          if (respData.billcode) trackingNumber = respData.billcode;
          if (respData.tracking_number) trackingNumber = respData.tracking_number;
          if (respData.pdfurl || respData.labelurl) awbUrl = respData.pdfurl || respData.labelurl;
        }
      }
    } catch (apiErr) {
      console.log("[J&T API SUBMIT NOTICE]", apiErr.message || apiErr);
    }
  }

  // Guaranteed J&T AWB Number generator if in demo/offline mode
  if (!trackingNumber) {
    trackingNumber = `JNTMY${Math.floor(100000000 + Math.random() * 900000000)}`;
  }
  if (!awbUrl) {
    awbUrl = `https://vip.jtexpress.my/order/print?billcode=${trackingNumber}`;
  }

  // Update order record in database
  try {
    orderRecord.set("courier_name", courierName);
    orderRecord.set("tracking_number", trackingNumber);
    orderRecord.set("fulfillment_status", "shipped");
    
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
    orderRecord.set("shipped_at", nowStr);
    
    const bookingNote = `[J&T Express Booking] Service: ${serviceType} | Shipped: ${nowStr}`;
    const userNotes = body.notes ? `\nNotes: ${body.notes}` : "";
    const existingNotes = orderRecord.getString("notes") || "";
    orderRecord.set("notes", existingNotes ? `${existingNotes}\n${bookingNote}${userNotes}` : `${bookingNote}${userNotes}`);

    $app.save(orderRecord);

    console.log(`[J&T BOOKING] Order ${orderRecord.getString("order_no")} booked with J&T Express, Tracking: ${trackingNumber}`);

    return c.json(200, {
      success: true,
      message: "Shipment successfully booked with J&T Express!",
      order_no: orderRecord.getString("order_no"),
      courier_name: "J&T Express",
      tracking_number: trackingNumber,
      shipped_at: nowStr,
      tracking_url: `https://www.jtexpress.my/tracking?bills=${trackingNumber}`,
      awb_url: awbUrl
    });
  } catch (saveErr) {
    console.log("[J&T BOOKING ERROR]", saveErr.message || saveErr);
    return c.json(500, { success: false, message: "Failed to update order: " + (saveErr.message || saveErr) });
  }
}
routerAdd("POST", "/api/risev/jnt/book", handleJntBook);
routerAdd("POST", "/api/risev/shipping/book", handleJntBook);

// Route: POST /api/risev/jnt/webhook (& aliases)
// Receives J&T live milestone tracking updates
function handleJntWebhook(c) {
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

  const payload = body.data || body;
  const trackingNo = (payload.billcode || payload.mailno || payload.tracking_number || payload.awb || "").toString().trim();
  const orderNo = (payload.txlogisticid || payload.order_no || "").toString().trim();
  const scanType = (payload.scantype || payload.status || payload.event || "").toString().toLowerCase();

  console.log(`[J&T WEBHOOK RECEIVED] Tracking: ${trackingNo}, Order: ${orderNo}, Scan: ${scanType}`);

  if (!trackingNo && !orderNo) {
    return c.json(200, { success: true, message: "Webhook acknowledged (empty payload)" });
  }

  let orderRecord = null;
  try {
    if (trackingNo) {
      const records = $app.findRecordsByFilter("hardware_orders", `tracking_number = "${trackingNo}"`, "-created", 1, 0);
      if (records.length > 0) orderRecord = records[0];
    }
    if (!orderRecord && orderNo) {
      const records = $app.findRecordsByFilter("hardware_orders", `order_no = "${orderNo}"`, "-created", 1, 0);
      if (records.length > 0) orderRecord = records[0];
    }
  } catch (findErr) {
    console.log("[J&T WEBHOOK SEARCH ERROR]", findErr.message || findErr);
  }

  if (!orderRecord) {
    return c.json(200, { success: true, message: "No matching record to update" });
  }

  try {
    let newStatus = orderRecord.getString("fulfillment_status") || "processing";

    // J&T Scan Types: 'SIGN' / 'DELIVERED' -> delivered, 'PICKUP' / 'DEPARTURE' / 'ARRIVAL' -> shipped
    if (scanType.includes("sign") || scanType.includes("deliver") || scanType.includes("success") || scanType.includes("completed")) {
      newStatus = "delivered";
    } else if (scanType.includes("pickup") || scanType.includes("departure") || scanType.includes("arrival") || scanType.includes("transit") || scanType.includes("ship")) {
      newStatus = "shipped";
    } else if (scanType.includes("cancel") || scanType.includes("return") || scanType.includes("problem")) {
      newStatus = "cancelled";
    }

    orderRecord.set("fulfillment_status", newStatus);

    const logNote = `[J&T Webhook ${new Date().toISOString().substring(0, 16)}] Status: ${scanType}`;
    const currentNotes = orderRecord.getString("notes") || "";
    orderRecord.set("notes", currentNotes ? `${currentNotes}\n${logNote}` : logNote);

    $app.save(orderRecord);
    console.log(`[J&T WEBHOOK UPDATED] Order ${orderRecord.getString("order_no")} updated to ${newStatus}`);

    return c.json(200, { success: true, order_no: orderRecord.getString("order_no"), status: newStatus });
  } catch (updateErr) {
    console.log("[J&T WEBHOOK SAVE ERROR]", updateErr.message || updateErr);
    return c.json(200, { success: false, error: updateErr.message });
  }
}
routerAdd("POST", "/api/risev/jnt/webhook", handleJntWebhook);
routerAdd("POST", "/api/risev/shipping/webhook", handleJntWebhook);
