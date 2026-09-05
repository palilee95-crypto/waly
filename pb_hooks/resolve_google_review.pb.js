// pb_hooks/resolve_google_review.pb.js
// Route: POST /api/risev/google-review/resolve
// Resolves any Google Maps short link (maps.app.goo.gl), Place link, or Place ID into a 1-click Direct Review URL

routerAdd("POST", "/api/risev/google-review/resolve", (e) => {
  function convertHexPairToPlaceId(hex1, hex2) {
    try {
      const h1 = hex1.replace(/^0x/i, '').padStart(16, '0');
      const h2 = hex2.replace(/^0x/i, '').padStart(16, '0');

      const bytes = [];
      // hex1 in little endian (8 bytes)
      for (let i = 14; i >= 0; i -= 2) {
        bytes.push(parseInt(h1.substr(i, 2), 16));
      }
      // Protobuf tag 2 (fixed64 = 0x11)
      bytes.push(0x11);
      // hex2 in little endian (8 bytes)
      for (let i = 14; i >= 0; i -= 2) {
        bytes.push(parseInt(h2.substr(i, 2), 16));
      }

      // Base64 encode bytes
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      let base64 = "";
      for (let i = 0; i < binary.length; i += 3) {
        const b0 = binary.charCodeAt(i);
        const b1 = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
        const b2 = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
        const triple = (b0 << 16) | (b1 << 8) | b2;
        base64 += chars.charAt((triple >> 18) & 63);
        base64 += chars.charAt((triple >> 12) & 63);
        base64 += (i + 1 < binary.length) ? chars.charAt((triple >> 6) & 63) : '=';
        base64 += (i + 2 < binary.length) ? chars.charAt(triple & 63) : '=';
      }

      base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return 'ChIJ' + base64;
    } catch (err) {
      return null;
    }
  }

  let body = {};
  try {
    body = e.requestInfo().body || {};
  } catch (err) {
    try {
      body = $apis.requestInfo(e).body || {};
    } catch (err2) {
      body = {};
    }
  }

  let input = (body.url || "").trim();
  if (!input) {
    return e.json(400, { success: false, message: "URL or Place ID is required" });
  }

  // 1. Direct Place ID provided (starts with ChIJ)
  if (input.startsWith("ChIJ") && input.length >= 20 && !input.includes(" ") && !input.includes("/")) {
    return e.json(200, {
      success: true,
      place_id: input,
      direct_url: `https://search.google.com/local/writereview?placeid=${input}`,
      type: "place_id_direct"
    });
  }

  // 2. Already a direct writereview link
  if (input.includes("search.google.com/local/writereview") && input.includes("placeid=")) {
    return e.json(200, {
      success: true,
      direct_url: input.startsWith("http") ? input : `https://${input}`,
      type: "writereview_direct"
    });
  }

  // 3. Google Business short link (g.page)
  if (input.includes("g.page/")) {
    let clean = input.startsWith("http") ? input : `https://${input}`;
    if (!clean.endsWith("/review") && !clean.includes("?")) {
      clean = `${clean}/review`;
    }
    return e.json(200, {
      success: true,
      direct_url: clean,
      type: "g_page_review"
    });
  }

  // 4. Check if direct hex feature ID pair is inside URL (e.g., !1s0x304b...:0x54cd... or %3A)
  const hexPairMatch = input.match(/(0x[0-9a-fA-F]+)(?:%3A|:)(0x[0-9a-fA-F]+)/i);
  if (hexPairMatch && hexPairMatch[1] && hexPairMatch[2]) {
    const generatedPlaceId = convertHexPairToPlaceId(hexPairMatch[1], hexPairMatch[2]);
    if (generatedPlaceId) {
      return e.json(200, {
        success: true,
        place_id: generatedPlaceId,
        direct_url: `https://search.google.com/local/writereview?placeid=${generatedPlaceId}`,
        type: "converted_from_hex_feature_id"
      });
    }
  }

  // 5. If URL has placeid= parameter directly
  const placeIdParamMatch = input.match(/placeid=([a-zA-Z0-9_-]+)/i);
  if (placeIdParamMatch && placeIdParamMatch[1]) {
    const pid = placeIdParamMatch[1];
    return e.json(200, {
      success: true,
      place_id: pid,
      direct_url: `https://search.google.com/local/writereview?placeid=${pid}`,
      type: "placeid_param"
    });
  }

  // 6. Short link (maps.app.goo.gl, goo.gl/maps) or standard google.com/maps URL -> Fetch and resolve
  let fetchUrl = input;
  if (!fetchUrl.startsWith("http://") && !fetchUrl.startsWith("https://")) {
    fetchUrl = `https://${fetchUrl}`;
  }

  // SSRF Protection: Validate allowed Google domains and reject internal/private destinations
  const allowedGoogleHostRegex = /^(?:[a-zA-Z0-9-]+\.)*(?:google\.com|google\.com\.[a-z]{2}|goo\.gl|g\.page)$/i;
  let parsedHost = "";
  try {
    const hostMatch = fetchUrl.match(/^https?:\/\/([^/?#:]+)/i);
    if (hostMatch) {
      parsedHost = hostMatch[1].toLowerCase();
    }
  } catch (hErr) {}

  if (!parsedHost || !allowedGoogleHostRegex.test(parsedHost)) {
    return e.json(400, { success: false, message: "Invalid URL. Only Google Maps and Google Business URLs are supported." });
  }

  if (parsedHost === "localhost" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|::1)/.test(parsedHost)) {
    return e.json(400, { success: false, message: "Invalid domain target." });
  }

  try {
    const res = $http.send({
      method: "GET",
      url: fetchUrl,
      headers: {
        "User-Agent": "curl/7.68.0",
        "Accept": "*/*"
      }
    });

    const rawHtml = (res.raw || res.rawText || res.body || "") + " " + JSON.stringify(res.headers || {});

    // 6a. Check if hex pair exists inside response HTML or redirect URL (including %3A)
    const htmlHexMatch = rawHtml.match(/(0x[0-9a-fA-F]+)(?:%3A|:)(0x[0-9a-fA-F]+)/i);
    if (htmlHexMatch && htmlHexMatch[1] && htmlHexMatch[2]) {
      const generatedPid = convertHexPairToPlaceId(htmlHexMatch[1], htmlHexMatch[2]);
      if (generatedPid) {
        return e.json(200, {
          success: true,
          place_id: generatedPid,
          direct_url: `https://search.google.com/local/writereview?placeid=${generatedPid}`,
          type: "resolved_from_html_hex"
        });
      }
    }

    // 6b. Look for standard ChIJ Place ID inside response HTML
    const placeIdMatches = rawHtml.match(/ChIJ[a-zA-Z0-9_-]{20,}/g);
    if (placeIdMatches && placeIdMatches.length > 0) {
      const detectedPlaceId = placeIdMatches[0];
      return e.json(200, {
        success: true,
        place_id: detectedPlaceId,
        direct_url: `https://search.google.com/local/writereview?placeid=${detectedPlaceId}`,
        type: "resolved_from_html"
      });
    }

    // 6c. Look for writereview link in HTML
    const writeReviewMatch = rawHtml.match(/https:\/\/search\.google\.com\/local\/writereview\?placeid=([a-zA-Z0-9_-]+)/);
    if (writeReviewMatch && writeReviewMatch[1]) {
      return e.json(200, {
        success: true,
        place_id: writeReviewMatch[1],
        direct_url: `https://search.google.com/local/writereview?placeid=${writeReviewMatch[1]}`,
        type: "resolved_writereview_link"
      });
    }

    // 6d. Look for g.page link in HTML
    const gpageMatch = rawHtml.match(/https:\/\/g\.page\/r\/[a-zA-Z0-9_-]+/);
    if (gpageMatch && gpageMatch[0]) {
      return e.json(200, {
        success: true,
        direct_url: `${gpageMatch[0]}/review`,
        type: "resolved_gpage_link"
      });
    }

    // Fallback: return original URL with https
    return e.json(200, {
      success: true,
      direct_url: fetchUrl,
      type: "fallback_original"
    });
  } catch (fetchErr) {
    console.log("[RESOLVE GOOGLE REVIEW ERROR]", fetchErr.message || fetchErr);
    return e.json(200, {
      success: true,
      direct_url: fetchUrl,
      type: "fallback_on_error"
    });
  }
});
