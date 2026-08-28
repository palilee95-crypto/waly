// pb_hooks/resolve_google_review.pb.js
// Route: POST /api/risev/google-review/resolve
// Resolves any Google Maps short link (maps.app.goo.gl), Place link, or Place ID into a 1-click Direct Review URL

routerAdd("POST", "/api/risev/google-review/resolve", (e) => {
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

  // 4. If URL has placeid= parameter directly
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

  // 5. Short link (maps.app.goo.gl, goo.gl/maps) or standard google.com/maps URL -> Fetch and resolve
  let fetchUrl = input;
  if (!fetchUrl.startsWith("http://") && !fetchUrl.startsWith("https://")) {
    fetchUrl = `https://${fetchUrl}`;
  }

  try {
    const res = $http.send({
      method: "GET",
      url: fetchUrl,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const rawHtml = res.rawText || "";

    // 5a. Look for standard ChIJ Place ID inside response HTML
    // Google places often embed: ["ChIJ..."] or data-placeid="ChIJ..." or "/maps/place/.../data=...1s(ChIJ...)"
    const placeIdMatches = rawHtml.match(/ChIJ[a-zA-Z0-9_-]{20,}/g);
    if (placeIdMatches && placeIdMatches.length > 0) {
      // Pick the first valid Place ID
      const detectedPlaceId = placeIdMatches[0];
      return e.json(200, {
        success: true,
        place_id: detectedPlaceId,
        direct_url: `https://search.google.com/local/writereview?placeid=${detectedPlaceId}`,
        type: "resolved_from_html"
      });
    }

    // 5b. Look for writereview link in HTML
    const writeReviewMatch = rawHtml.match(/https:\/\/search\.google\.com\/local\/writereview\?placeid=([a-zA-Z0-9_-]+)/);
    if (writeReviewMatch && writeReviewMatch[1]) {
      return e.json(200, {
        success: true,
        place_id: writeReviewMatch[1],
        direct_url: `https://search.google.com/local/writereview?placeid=${writeReviewMatch[1]}`,
        type: "resolved_writereview_link"
      });
    }

    // 5c. Look for g.page link in HTML
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
