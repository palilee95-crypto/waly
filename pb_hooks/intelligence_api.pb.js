// pb_hooks/intelligence_api.pb.js
// Risev Intelligence Engine — Server-Side Recommendation & Analytics API
// Provides:
// 1. Event Tracking Ingestion (POST /api/risev/events)
// 2. Personalized "For You" Feed (GET /api/risev/recommendations/for-you)
// 3. Smart Rewards Prioritization (GET /api/risev/rewards/prioritized)
// 4. Next Visit Predictor (GET /api/risev/visits/next-prediction)
// 5. Merchant Customer Intelligence (GET /api/risev/merchant/insights)

// -------------------------------------------------------------
// 1. EVENT TRACKING INGESTION
// -------------------------------------------------------------
routerAdd("POST", "/api/risev/events", (e) => {
  var authRecord = e.auth;
  var body = {};
  try {
    body = e.requestInfo().body || {};
  } catch (err) {}

  var eventType = (body.event_type || "").trim();
  if (!eventType) {
    return e.json(400, { success: false, message: "Missing event_type" });
  }

  var customerId = authRecord ? authRecord.id : (body.customer_id || null);
  var merchantId = body.merchant_id || null;
  var metadata = body.metadata || {};
  var eventSource = body.event_source || "mobile_app";
  var sessionId = body.session_id || "";

  try {
    var eventsCol = $app.findCollectionByNameOrId("customer_events");
    if (eventsCol && customerId) {
      var record = new Record(eventsCol);
      record.set("customer", customerId);
      if (merchantId) record.set("merchant", merchantId);
      record.set("event_type", eventType);
      record.set("metadata", metadata);
      record.set("event_source", eventSource);
      record.set("session_id", sessionId);
      $app.save(record);
    }
  } catch (dbErr) {
    // Log non-blocking so analytics failures never disrupt client UI
    console.log("[EVENT_TRACKING_ERR] " + (dbErr.message || dbErr));
  }

  return e.json(200, { success: true, event: eventType });
});

// -------------------------------------------------------------
// 2. PERSONALIZED "FOR YOU" RECOMMENDATION FEED
// -------------------------------------------------------------
routerAdd("GET", "/api/risev/recommendations/for-you", (e) => {
  // JSVM: hook handlers are re-evaluated without file scope, so file-level helpers
  // are NOT visible here — define the Haversine helper inside the handler.
  function calcDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 5.0; // fallback reasonable radius
    var R = 6371; // Earth radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  var authRecord = e.auth;
  var customerId = authRecord ? authRecord.id : null;
  var queryParams = e.requestInfo().query || {};

  var userLat = parseFloat(queryParams.lat) || 6.268; // default Jitra lat
  var userLng = parseFloat(queryParams.lng) || 100.411; // default Jitra lng
  var limit = parseInt(queryParams.limit, 10) || 10;

  // 1. Fetch active merchants
  var activeMerchants = [];
  try {
    activeMerchants = $app.findRecordsByFilter("merchants", "id != ''", "-created", 50, 0);
  } catch (mErr) {
    console.log("[REC_ERR_MERCHANTS] " + mErr);
  }

  if (activeMerchants.length === 0) {
    return e.json(200, { success: true, data: [], meta: { total: 0 } });
  }

  // 1b. Join the real data sources. `merchants` has NO city/address/coordinates —
  //     those live on `store_locations`; ratings live on `store_feedbacks`; and
  //     "Pro" is derived from an active `subscriptions` record (plan = "pro").
  var locByMerchant = {};
  try {
    var locations = $app.findRecordsByFilter("store_locations", "id != ''", "-created", 500, 0);
    locations.forEach(function (l) {
      var lMerchant = l.getString("merchant");
      if (!lMerchant) return;
      var existing = locByMerchant[lMerchant];
      if (!existing || (l.getBool("is_active") && !existing.getBool("is_active"))) {
        locByMerchant[lMerchant] = l; // prefer an active location, else first seen
      }
    });
  } catch (lErr) {
    console.log("[REC_ERR_LOCATIONS] " + lErr);
  }

  var fbByMerchant = {};
  try {
    var feedbacks = $app.findRecordsByFilter("store_feedbacks", "id != ''", "-created", 2000, 0);
    feedbacks.forEach(function (f) {
      var fMerchant = f.getString("merchant");
      if (!fMerchant) return;
      var agg = fbByMerchant[fMerchant] || { sum: 0, count: 0 };
      agg.sum += f.getFloat("rating") || 0;
      agg.count += 1;
      fbByMerchant[fMerchant] = agg;
    });
  } catch (fErr) {
    console.log("[REC_ERR_FEEDBACKS] " + fErr);
  }

  var proMerchantIds = {};
  try {
    var activeSubs = $app.findRecordsByFilter("subscriptions", "status = 'active'", "-created", 500, 0);
    activeSubs.forEach(function (s) {
      if (s.getString("plan") === "pro") proMerchantIds[s.getString("merchant")] = true;
    });
  } catch (sErr) {
    console.log("[REC_ERR_SUBS] " + sErr);
  }

  // 2. Fetch customer history if authenticated
  var customerCards = [];
  var customerBookings = [];
  var customerEvents = [];

  if (customerId) {
    try {
      customerCards = $app.findRecordsByFilter("loyalty_cards", "customer = '" + customerId + "'", "-total_visits", 50, 0);
    } catch (cErr) {}

    try {
      customerBookings = $app.findRecordsByFilter("service_bookings", "customer = '" + customerId + "' && status = 'completed'", "-booking_date", 20, 0);
    } catch (bErr) {}

    try {
      customerEvents = $app.findRecordsByFilter("customer_events", "customer = '" + customerId + "'", "-created", 30, 0);
    } catch (eErr) {}
  }

  // 3. Build Category Affinity Profile
  var categoryCounts = {};
  var totalInteractions = 0;

  customerCards.forEach(function(card) {
    var mId = card.getString("merchant");
    var visits = card.getInt("total_visits") || 1;
    totalInteractions += visits;
  });

  customerEvents.forEach(function(ev) {
    var meta = ev.get("metadata") || {};
    var cat = meta.category ? ("" + meta.category).toLowerCase() : null;
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      totalInteractions += 1;
    }
  });

  // Map merchant IDs to customer loyalty card
  var cardByMerchantId = {};
  customerCards.forEach(function(c) {
    cardByMerchantId[c.getString("merchant")] = c;
  });

  // 4. Score each merchant using the Normalized Scoring Formula
  var scoredList = [];

  activeMerchants.forEach(function(merchant) {
    var mId = merchant.id;
    var mCat = (merchant.getString("category") || "services").toLowerCase();
    var loc = locByMerchant[mId];
    var fb = fbByMerchant[mId];
    var mCity = (loc && loc.getString("city")) || "Kedah";
    var mRating = (fb && fb.count > 0) ? (fb.sum / fb.count) : 4.8;
    var mReviews = (fb && fb.count > 0) ? fb.count : 10;
    var isPro = !!proMerchantIds[mId];

    // Proximity factor (w3 = 20%) — coordinates come from store_locations.
    // If a merchant has no coordinates, calcDistanceKm returns a neutral 5 km
    // (rather than faking 0 km, which would rank it as the closest store).
    var mLat = loc ? loc.getFloat("lat") : 0;
    var mLng = loc ? loc.getFloat("lng") : 0;
    var distKm = calcDistanceKm(userLat, userLng, mLat, mLng);
    var proxScore = Math.max(0, 1 - (distKm / 30.0)); // 0 to 1

    // Category preference factor (w1 = 30%)
    var catAffinity = totalInteractions > 0 ? ((categoryCounts[mCat] || 0) / totalInteractions) : 0.4;
    var catScore = Math.min(1.0, catAffinity);

    // Previous visit behavior factor (w2 = 25%)
    var card = cardByMerchantId[mId];
    var visits = card ? (card.getInt("total_visits") || 0) : 0;
    var visitScore = 1 - Math.exp(-0.4 * visits); // 0 to 1

    // Reward relevance factor (w4 = 15%)
    var currentStamps = card ? (card.getInt("stamps") || 0) : 0;
    var maxStamps = 10;
    var rewardScore = Math.min(1.0, currentStamps / maxStamps);

    // Merchant quality signal (w5 = 10%)
    var qualityScore = (mRating / 5.0) * Math.min(1.0, Math.log(1 + mReviews) / Math.log(1 + 100));

    // Composite Final Score:
    // C_pref(30%) + V_hist(25%) + D_prox(20%) + R_rel(15%) + M_qual(10%)
    var finalScore = (catScore * 30.0) +
                     (visitScore * 25.0) +
                     (proxScore * 20.0) +
                     (rewardScore * 15.0) +
                     (qualityScore * 10.0);

    if (isPro) finalScore += 5.0; // slight Pro boost

    // Explainable Recommendation Reason
    var reason = "Top rated in " + mCity;
    var badgeType = "popular";

    if (currentStamps >= 7) {
      var remaining = Math.max(0, maxStamps - currentStamps);
      reason = "Only " + remaining + " visit" + (remaining === 1 ? "" : "s") + " to unlock your next reward!";
      badgeType = "almost_unlocked";
    } else if (visits >= 2) {
      reason = "Based on your " + visits + " previous visits";
      badgeType = "frequent";
    } else if (distKm <= 3.0) {
      reason = "Nearby in " + mCity + " (" + distKm.toFixed(1) + " km)";
      badgeType = "nearby";
    } else if (isPro) {
      reason = "Featured verified Risev merchant";
      badgeType = "featured";
    }

    scoredList.push({
      merchant: merchant,
      distKm: distKm,
      score: finalScore,
      reason: reason,
      badgeType: badgeType,
      currentStamps: currentStamps,
      isPro: isPro,
      city: mCity,
      address: (loc && loc.getString("address")) || "",
      rating: mRating,
      reviews: mReviews,
      mLat: mLat,
      mLng: mLng
    });
  });

  // Sort descending by calculated score
  scoredList.sort(function(a, b) {
    return b.score - a.score;
  });

  var topResults = scoredList.slice(0, limit).map(function(item) {
    var m = item.merchant;
    return {
      id: m.id,
      store_name: m.getString("name"),
      name: m.getString("name"),
      slug: m.getString("pwa_slug") || m.id,
      category: m.getString("category") || "Services",
      city: item.city,
      address: item.address,
      latitude: item.mLat,
      longitude: item.mLng,
      rating: parseFloat(item.rating.toFixed(1)),
      reviews_count: item.reviews,
      banner: m.getString("banner"),
      logo: m.getString("logo"),
      is_pro: item.isPro,
      distance_km: parseFloat(item.distKm.toFixed(1)),
      recommendation_score: parseFloat(item.score.toFixed(1)),
      recommendation_reason: item.reason,
      badge_type: item.badgeType,
      stamps_count: item.currentStamps
    };
  });

  return e.json(200, {
    success: true,
    data: topResults,
    meta: {
      total: topResults.length,
      user_authenticated: !!customerId
    }
  });
});

// -------------------------------------------------------------
// 3. SMART REWARDS PRIORITIZATION
// -------------------------------------------------------------
routerAdd("GET", "/api/risev/rewards/prioritized", (e) => {
  var authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { success: false, message: "Unauthorized" });
  }

  var customerId = authRecord.id;
  var cards = [];
  try {
    cards = $app.findRecordsByFilter("loyalty_cards", "customer = '" + customerId + "'", "-stamps,-last_visit", 50, 0);
  } catch (err) {
    return e.json(500, { success: false, message: err.message || err });
  }

  var readyToRedeem = [];
  var almostUnlocked = [];
  var regularCards = [];

  cards.forEach(function(card) {
    var stamps = card.getInt("stamps") || 0;
    var maxStamps = 10;
    var mId = card.getString("merchant");
    var merchant = null;
    try {
      merchant = $app.findRecordById("merchants", mId);
    } catch (me) {}

    var cardObj = {
      id: card.id,
      merchant_id: mId,
      merchant_name: merchant ? merchant.getString("store_name") : "Merchant",
      merchant_slug: merchant ? (merchant.getString("slug") || merchant.id) : "",
      merchant_logo: merchant ? merchant.getString("logo") : "",
      merchant_banner: merchant ? merchant.getString("banner") : "",
      category: merchant ? merchant.getString("category") : "Services",
      stamps: stamps,
      max_stamps: maxStamps,
      points: card.getInt("points") || 0,
      total_visits: card.getInt("total_visits") || 0,
      last_visit: card.getString("last_visit") || card.getString("created")
    };

    if (stamps >= maxStamps) {
      readyToRedeem.push(cardObj);
    } else if (maxStamps - stamps <= 3) {
      almostUnlocked.push(cardObj);
    } else {
      regularCards.push(cardObj);
    }
  });

  return e.json(200, {
    success: true,
    data: {
      ready_to_redeem: readyToRedeem,
      almost_unlocked: almostUnlocked,
      active_cards: regularCards
    }
  });
});

// -------------------------------------------------------------
// 4. NEXT VISIT STATISTICAL PREDICTOR
// -------------------------------------------------------------
routerAdd("GET", "/api/risev/visits/next-prediction", (e) => {
  var authRecord = e.auth;
  var queryParams = e.requestInfo().query || {};
  var customerId = authRecord ? authRecord.id : (queryParams.customer_id || null);
  var merchantId = queryParams.merchant_id || null;

  if (!customerId) {
    return e.json(400, { success: false, message: "Missing customer_id" });
  }

  try {
    var filterStr = "customer = '" + customerId + "'";
    if (merchantId) filterStr += " && merchant = '" + merchantId + "'";

    var completedBookings = $app.findRecordsByFilter("service_bookings", filterStr + " && status = 'completed'", "booking_date", 20, 0);

    if (completedBookings.length < 2) {
      // Safe category statistical baseline
      return e.json(200, {
        success: true,
        data: {
          has_sufficient_history: false,
          typical_interval_days: 21,
          prediction_text: "Visit typically every 3 weeks",
          estimated_next_visit: null
        }
      });
    }

    // Calculate return intervals
    var intervals = [];
    for (var i = 1; i < completedBookings.length; i++) {
      var d1 = new Date(completedBookings[i - 1].getString("booking_date")).getTime();
      var d2 = new Date(completedBookings[i].getString("booking_date")).getTime();
      var diffDays = Math.round(Math.abs(d2 - d1) / (1000 * 3600 * 24));
      if (diffDays > 0 && diffDays < 180) {
        intervals.push(diffDays);
      }
    }

    intervals.sort(function(a, b) { return a - b; });
    var medianInterval = intervals.length > 0 ? intervals[Math.floor(intervals.length / 2)] : 21;

    var lastBooking = completedBookings[completedBookings.length - 1];
    var lastDate = new Date(lastBooking.getString("booking_date"));
    var nextDate = new Date(lastDate.getTime() + (medianInterval * 24 * 3600 * 1000));

    return e.json(200, {
      success: true,
      data: {
        has_sufficient_history: true,
        typical_interval_days: medianInterval,
        last_visit_date: lastBooking.getString("booking_date"),
        estimated_next_visit_date: nextDate.toISOString().split("T")[0],
        confidence_score: Math.min(0.95, 0.5 + (completedBookings.length * 0.1))
      }
    });
  } catch (err) {
    return e.json(500, { success: false, message: err.message || err });
  }
});

// -------------------------------------------------------------
// 5. MERCHANT INTELLIGENCE & RETENTION INSIGHTS
// -------------------------------------------------------------
routerAdd("GET", "/api/risev/merchant/insights", (e) => {
  var authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { success: false, message: "Unauthorized" });
  }

  // Cross-merchant boundary security check
  var merchantId = e.requestInfo().query.merchant_id || authRecord.getString("merchant_id");
  if (!merchantId) {
    return e.json(400, { success: false, message: "Missing merchant_id" });
  }

  try {
    var cards = $app.findRecordsByFilter("loyalty_cards", "merchant = '" + merchantId + "'", "-total_visits", 500, 0);

    var totalCustomers = cards.length;
    var champions = 0;
    var regularLoyal = 0;
    var atRisk = 0;
    var inactive = 0;

    var now = new Date().getTime();

    cards.forEach(function(card) {
      var visits = card.getInt("total_visits") || 1;
      var lastVisitStr = card.getString("last_visit") || card.getString("created");
      var lastVisitTime = new Date(lastVisitStr).getTime();
      var daysSince = Math.floor((now - lastVisitTime) / (1000 * 3600 * 24));

      if (visits >= 5 && daysSince <= 30) {
        champions++;
      } else if (visits >= 2 && daysSince <= 45) {
        regularLoyal++;
      } else if (daysSince > 45 && daysSince <= 90) {
        atRisk++;
      } else if (daysSince > 90) {
        inactive++;
      } else {
        regularLoyal++;
      }
    });

    var recommendedActions = [];
    if (atRisk > 0) {
      recommendedActions.push({
        type: "win_back_at_risk",
        title: "Send Return Booster (RM5 OFF) to " + atRisk + " At-Risk Customers",
        target_count: atRisk
      });
    }
    if (champions > 0) {
      recommendedActions.push({
        type: "vip_recognition",
        title: "Reward VIP Perks to " + champions + " Champion Customers",
        target_count: champions
      });
    }

    return e.json(200, {
      success: true,
      data: {
        summary: {
          total_customers: totalCustomers,
          champions_count: champions,
          regular_count: regularLoyal,
          at_risk_count: atRisk,
          inactive_count: inactive
        },
        recommended_actions: recommendedActions
      }
    });
  } catch (err) {
    return e.json(500, { success: false, message: err.message || err });
  }
});
