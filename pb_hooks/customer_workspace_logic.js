// Customer Workspace metrics.
//
// Required from pb_hooks/customer_workspace.pb.js: JSVM hook handlers do not see
// file-level declarations, but a require()d module is evaluated normally.
//
// Definitions are fixed here and must not drift (see the plan):
//   visited      distinct customers with a recorded transaction in scope+period
//   new / returns  first-ever recorded visit falls inside / before the period (mutually exclusive)
//   AOV          eligible sales / eligible orders, never / customers
//   stamps       net stamp events, not visits and not customers
//   missing      returned as null, never coerced to 0
//
// Time: `created` is stored in UTC, so period boundaries are converted from the
// merchant's local calendar (UTC+8) to UTC. `service_bookings.booking_date` is a
// plain local text date and is compared as a string.

const DAY_MS = 86400000;
const DEFAULT_RETURN_DAYS = 30;

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

/** Local (UTC+8) calendar date for an offset in days, as YYYY-MM-DD. */
function localDate(offsetDays) {
  const t = new Date(Date.now() + 8 * 3600000 + (offsetDays || 0) * DAY_MS);
  return t.getUTCFullYear() + "-" + pad2(t.getUTCMonth() + 1) + "-" + pad2(t.getUTCDate());
}

/** 'YYYY-MM-DD' local midnight -> PocketBase UTC datetime string. */
function localDateToUtcStart(dateStr) {
  const t = new Date(String(dateStr) + "T00:00:00+08:00");
  return t.toISOString().replace("T", " ").slice(0, 19);
}

function utcNowString() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Parse a PocketBase datetime ('2026-10-19 02:03:04.567Z') to epoch ms.
 * The stored value already ends with Z, so appending another one would yield
 * an invalid date and poison JSON with NaN.
 */
function parsePbDate(value) {
  let v = String(value || "").trim();
  if (!v) return null;
  v = v.replace(" ", "T");
  if (!/Z$/i.test(v)) v += "Z";
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
}

function addDays(dateStr, days) {
  const t = new Date(String(dateStr) + "T00:00:00+08:00");
  const u = new Date(t.getTime() + days * DAY_MS + 8 * 3600000);
  return u.getUTCFullYear() + "-" + pad2(u.getUTCMonth() + 1) + "-" + pad2(u.getUTCDate());
}

/**
 * Branch predicate. An empty transactions.branch counts as HQ, so scoping to the
 * HQ branch must also match rows with no branch.
 */
function branchClause(ctx, column) {
  if (!ctx.branchId) return "";
  const col = column || "t.branch";
  if (ctx.isHqBranch) {
    return " AND (" + col + " = {:bid} OR " + col + " = '' OR " + col + " IS NULL)";
  }
  return " AND " + col + " = {:bid}";
}

function bindBase(ctx) {
  const b = { mid: ctx.merchantId, fromUtc: ctx.fromUtc, toUtc: ctx.toUtc };
  if (ctx.branchId) b.bid = ctx.branchId;
  return b;
}

function scalar($app, sql, params, field) {
  const model = new DynamicModel({ v: 0 });
  $app.db().newQuery(sql).bind(params || {}).one(model);
  return model.v;
}

function rows($app, sql, params, shape) {
  const out = arrayOf(new DynamicModel(shape));
  $app.db().newQuery(sql).bind(params || {}).all(out);
  return out;
}

function buildSnapshot($app, ctx) {
  const base = bindBase(ctx);
  const scope = "t.merchant = {:mid}" + branchClause(ctx, "t.branch") + " AND t.type <> 'adjust'";

  // All-time first / last recorded visit per customer (new vs returning, inactivity).
  const lifetime = rows(
    $app,
    "SELECT t.customer as customer, MIN(t.created) as first_seen, MAX(t.created) as last_seen " +
      "FROM transactions t WHERE " + scope + " GROUP BY t.customer",
    base,
    { customer: "", first_seen: "", last_seen: "" }
  );

  const firstSeen = {};
  const lastSeen = {};
  lifetime.forEach(function (r) {
    firstSeen[r.customer] = r.first_seen;
    lastSeen[r.customer] = r.last_seen;
  });

  // Period activity per customer.
  // Aggregates are CAST to TEXT: DynamicModel infers the scan type from the JS
  // default, and SQLite returns REAL for SUM/AVG — an int default throws
  // "converting driver.Value type float64 to a int64".
  const period = rows(
    $app,
    "SELECT t.customer as customer, COUNT(*) as visits, " +
      "CAST(COALESCE(SUM(t.bill_amount), 0) AS TEXT) as sales, " +
      "CAST(COALESCE(SUM(t.stamps), 0) AS TEXT) as stamps, " +
      "CAST(COALESCE(SUM(t.points), 0) AS TEXT) as points, MAX(t.created) as last_visit " +
      "FROM transactions t WHERE " + scope +
      " AND t.created >= {:fromUtc} AND t.created < {:toUtc} GROUP BY t.customer",
    base,
    { customer: "", visits: 0, sales: "", stamps: "", points: "", last_visit: "" }
  );

  const visitedCustomers = period.map(function (r) {
    return r.customer;
  });
  const newCount = visitedCustomers.filter(function (id) {
    return firstSeen[id] && firstSeen[id] >= ctx.fromUtc;
  }).length;
  const returningCount = visitedCustomers.length - newCount;

  // Previous period of equal length, for the "vs last month" comparisons.
  const periodDays = Math.max(
    1,
    Math.round(
      (new Date(ctx.toDate + "T00:00:00+08:00").getTime() -
        new Date(ctx.fromDate + "T00:00:00+08:00").getTime()) / DAY_MS
    )
  );
  const prevFromDate = addDays(ctx.fromDate, -periodDays);
  const prevFromUtc = localDateToUtcStart(prevFromDate);

  const prevPeriod = rows(
    $app,
    "SELECT t.customer as customer, COUNT(*) as visits, " +
      "CAST(COALESCE(SUM(t.bill_amount), 0) AS TEXT) as sales " +
      "FROM transactions t WHERE " + scope +
      " AND t.created >= {:prevFromUtc} AND t.created < {:fromUtc} GROUP BY t.customer",
    Object.assign({}, base, { prevFromUtc: prevFromUtc }),
    { customer: "", visits: 0, sales: "" }
  );
  const prevVisited = prevPeriod.map(function (r) {
    return r.customer;
  });
  const prevNew = prevVisited.filter(function (id) {
    return firstSeen[id] && firstSeen[id] >= prevFromUtc;
  }).length;
  const prevSales = prevPeriod.reduce(function (total, r) {
    return total + (Number(r.sales) || 0);
  }, 0);

  // Daily visit counts (last 7 local days) for the Overview trend.
  const trendFrom = localDateToUtcStart(addDays(localDate(0), -6));
  const trendRows = rows(
    $app,
    "SELECT substr(t.created, 1, 10) as day, COUNT(*) as visits FROM transactions t " +
      "WHERE t.merchant = {:mid}" + branchClause(ctx, "t.branch") +
      " AND t.created >= {:trendFrom} AND t.type <> 'adjust' GROUP BY day",
    { mid: ctx.merchantId, trendFrom: trendFrom, bid: ctx.branchId || "" },
    { day: "", visits: 0 }
  );
  const trendMap = {};
  trendRows.forEach(function (r) {
    trendMap[r.day] = Number(r.visits) || 0;
  });
  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const local = addDays(localDate(0), -i);
    const utcDay = localDateToUtcStart(local).slice(0, 10);
    trend.push({ date: local, visits: trendMap[utcDay] || 0 });
  }

  // Top customers by recorded spend in the selected scope and period.
  const topCustomers = rows(
    $app,
    "SELECT u.id as id, u.name as name, u.avatar as avatar, COUNT(*) as visits, " +
      "MAX(t.created) as last_visit, CAST(COALESCE(SUM(t.bill_amount), 0) AS TEXT) as spend " +
      "FROM transactions t JOIN users u ON u.id = t.customer WHERE " + scope +
      " AND t.created >= {:fromUtc} AND t.created < {:toUtc} " +
      "GROUP BY u.id ORDER BY SUM(t.bill_amount) DESC, COUNT(*) DESC LIMIT 3",
    base,
    { id: "", name: "", avatar: "", visits: 0, last_visit: "", spend: "" }
  ).map(function (r) {
    return {
      id: r.id,
      name: r.name,
      avatar: r.avatar || "",
      visits: Number(r.visits) || 0,
      lastVisit: r.last_visit,
      spendCents: Math.round((Number(r.spend) || 0) * 100),
    };
  });

  let sales = 0;
  let stamps = 0;
  let points = 0;
  period.forEach(function (r) {
    sales += Number(r.sales) || 0;
    stamps += Number(r.stamps) || 0;
    points += Number(r.points) || 0;
  });

  const orders = Number(
    scalar(
      $app,
      "SELECT COUNT(*) as v FROM transactions t WHERE " + scope +
        " AND t.created >= {:fromUtc} AND t.created < {:toUtc} AND t.bill_amount > 0",
      base,
      "v"
    )
  ) || 0;

  // Bookings: booking_date is a local text date.
  const bookingBase = { mid: ctx.merchantId, fromDate: ctx.fromDate, toDate: ctx.toDate, today: localDate(0) };
  if (ctx.branchId) bookingBase.bid = ctx.branchId;
  const bookingBranch = branchClause(ctx, "b.branch");

  const bookingRows = rows(
    $app,
    "SELECT b.status as status, COUNT(*) as cnt FROM service_bookings b WHERE b.merchant = {:mid}" +
      bookingBranch + " AND b.booking_date >= {:fromDate} AND b.booking_date < {:toDate} GROUP BY b.status",
    bookingBase,
    { status: "", cnt: 0 }
  );
  const bookingCounts = { booked: 0, arrived: 0, in_service: 0, completed: 0, cancelled: 0, no_show: 0 };
  let bookingTotal = 0;
  bookingRows.forEach(function (r) {
    const key = String(r.status || "");
    bookingCounts[key] = (bookingCounts[key] || 0) + (Number(r.cnt) || 0);
    bookingTotal += Number(r.cnt) || 0;
  });

  const futureBookingRows = rows(
    $app,
    "SELECT DISTINCT b.customer as customer FROM service_bookings b WHERE b.merchant = {:mid}" +
      bookingBranch + " AND b.status IN ('booked','arrived','in_service') AND b.booking_date >= {:today}",
    bookingBase,
    { customer: "" }
  );
  const hasFutureBooking = {};
  futureBookingRows.forEach(function (r) {
    if (r.customer) hasFutureBooking[r.customer] = true;
  });

  // Overdue: last recorded visit older than the merchant's own return cadence,
  // excluding anyone already booked in.
  const returnDays = Number(ctx.returnDays) > 0 ? Number(ctx.returnDays) : DEFAULT_RETURN_DAYS;
  const cutoff = new Date(Date.now() - returnDays * DAY_MS).toISOString().replace("T", " ").slice(0, 19);
  let overdueCount = 0;
  Object.keys(lastSeen).forEach(function (id) {
    if (lastSeen[id] && lastSeen[id] < cutoff && !hasFutureBooking[id]) overdueCount++;
  });

  // Previously booked, overdue, and nothing booked ahead — a distinct audience from
  // "Bring customers back" (which includes people who never booked at all).
  const rebookCount = Number(
    scalar(
      $app,
      "SELECT COUNT(*) as v FROM (SELECT t.customer as id FROM transactions t WHERE " + scope +
        " GROUP BY t.customer HAVING MAX(t.created) < {:cutoff}) " +
        "WHERE id IN (SELECT b3.customer FROM service_bookings b3 WHERE b3.merchant = {:mid2} " +
        "AND b3.status = 'completed' AND b3.customer != '') " +
        "AND id NOT IN (SELECT b4.customer FROM service_bookings b4 WHERE b4.merchant = {:mid3} " +
        "AND b4.customer != '' AND b4.status IN ('booked','arrived','in_service') AND b4.booking_date >= {:today})",
      Object.assign({}, base, {
        cutoff: cutoff,
        mid2: ctx.merchantId,
        mid3: ctx.merchantId,
        today: localDate(0),
      }),
      "v"
    )
  ) || 0;

  // The "Inactive Customers" strip on the Reports screen.
  const inactive = rows(
    $app,
    "SELECT u.id as id, u.name as name, u.avatar as avatar, MAX(t.created) as last_seen " +
      "FROM transactions t JOIN users u ON u.id = t.customer WHERE " + scope +
      " GROUP BY u.id HAVING MAX(t.created) < {:cutoff} ORDER BY MAX(t.created) ASC LIMIT 5",
    Object.assign({}, base, { cutoff: cutoff }),
    { id: "", name: "", avatar: "", last_seen: "" }
  ).map(function (r) {
    const seen = parsePbDate(r.last_seen);
    return {
      id: r.id,
      name: r.name,
      avatar: r.avatar || "",
      lastVisit: r.last_seen,
      daysIdle: seen === null ? null : Math.floor((Date.now() - seen) / DAY_MS),
    };
  });

  // Loyalty: near reward (1-2 stamps left) and available vouchers.
  const nearReward = Number(
    scalar(
      $app,
      "SELECT COUNT(DISTINCT c.customer) as v FROM loyalty_cards c JOIN loyalty_programs p ON p.id = c.program " +
        "WHERE p.merchant = {:mid} AND c.status = 'active' AND p.stamp_goal > 0 " +
        "AND (p.stamp_goal - c.stamps_collected) BETWEEN 1 AND 2",
      { mid: ctx.merchantId },
      "v"
    )
  ) || 0;

  const nowUtc = utcNowString();
  const availableVouchers = Number(
    scalar(
      $app,
      "SELECT COUNT(DISTINCT v.customer) as v FROM vouchers v JOIN rewards r ON r.id = v.reward " +
        "WHERE r.merchant = {:mid} AND v.status = 'active' AND (v.expires_at IS NULL OR v.expires_at > {:now})",
      { mid: ctx.merchantId, now: nowUtc },
      "v"
    )
  ) || 0;

  // The Rewards audience is the deduplicated union of both groups — a customer with a
  // voucher AND a nearly-complete card must be counted once, matching the audience rows.
  const rewardAudience = Number(
    scalar(
      $app,
      "SELECT COUNT(*) as v FROM (" +
        "SELECT v.customer as id FROM vouchers v JOIN rewards r ON r.id = v.reward " +
        "WHERE r.merchant = {:mid} AND v.status = 'active' AND (v.expires_at IS NULL OR v.expires_at > {:now}) " +
        "UNION " +
        "SELECT c.customer as id FROM loyalty_cards c JOIN loyalty_programs p ON p.id = c.program " +
        "WHERE p.merchant = {:mid2} AND c.status = 'active' AND p.stamp_goal > 0 " +
        "AND (p.stamp_goal - c.stamps_collected) BETWEEN 1 AND 2" +
        ")",
      { mid: ctx.merchantId, mid2: ctx.merchantId, now: nowUtc },
      "v"
    )
  ) || 0;

  const vouchersRedeemed = Number(
    scalar(
      $app,
      "SELECT COUNT(*) as v FROM vouchers v JOIN rewards r ON r.id = v.reward " +
        "WHERE r.merchant = {:mid} AND v.status = 'used' AND v.used_at >= {:fromUtc} AND v.used_at < {:toUtc}",
      { mid: ctx.merchantId, fromUtc: ctx.fromUtc, toUtc: ctx.toUtc },
      "v"
    )
  ) || 0;

  // Birthdays in the next 7 local days, among this merchant's card holders.
  const birthdayOffsets = [];
  for (let i = 0; i <= 7; i++) birthdayOffsets.push(addDays(localDate(0), i).slice(5));
  const birthdayParams = { mid: ctx.merchantId };
  const birthdayIn = birthdayOffsets
    .map(function (d, i) {
      birthdayParams["d" + i] = d;
      return "{:d" + i + "}";
    })
    .join(",");
  const birthdayCount = Number(
    scalar(
      $app,
      "SELECT COUNT(DISTINCT u.id) as v FROM loyalty_cards c JOIN users u ON u.id = c.customer " +
        "WHERE c.merchant = {:mid} AND u.birthday <> '' AND substr(u.birthday, 6, 5) IN (" + birthdayIn + ")",
      birthdayParams,
      "v"
    )
  ) || 0;

  // Daily stamp series (last 7 local days). A day with no rows is a true zero stamps.
  const chartFrom = localDateToUtcStart(addDays(localDate(0), -6));
  const dailyRows = rows(
    $app,
    "SELECT substr(t.created, 1, 10) as day, CAST(COALESCE(SUM(t.stamps), 0) AS TEXT) as stamps FROM transactions t " +
      "WHERE t.merchant = {:mid}" + branchClause(ctx, "t.branch") +
      " AND t.created >= {:chartFrom} GROUP BY day",
    // Branch clause binds {:bid}; every bind map that uses it must carry the key.
    { mid: ctx.merchantId, chartFrom: chartFrom, bid: ctx.branchId || "" },
    { day: "", stamps: "" }
  );
  const dailyMap = {};
  dailyRows.forEach(function (r) {
    dailyMap[r.day] = Number(r.stamps) || 0;
  });
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const local = addDays(localDate(0), -i);
    // created is UTC: a local-day bucket starts 8h before the local date string.
    const utcDay = localDateToUtcStart(local).slice(0, 10);
    daily.push({ date: local, stamps: dailyMap[utcDay] || 0 });
  }

  // Feedback is merchant-wide: store_feedbacks has no branch relation.
  const feedbackBase = { mid: ctx.merchantId, fromUtc: ctx.fromUtc, toUtc: ctx.toUtc };
  const feedbackRow = rows(
    $app,
    "SELECT COUNT(*) as cnt, CAST(COALESCE(AVG(rating), 0) AS TEXT) as avg FROM store_feedbacks " +
      "WHERE merchant = {:mid} AND created >= {:fromUtc} AND created < {:toUtc}",
    feedbackBase,
    { cnt: 0, avg: "" }
  )[0];
  const feedbackCount = feedbackRow ? Number(feedbackRow.cnt) || 0 : 0;
  const avgRating = feedbackCount > 0 ? Number(feedbackRow.avg) : null;

  return {
    overview: {
      visited: visitedCustomers.length,
      newCount: newCount,
      returningCount: returningCount,
      salesCents: Math.round(sales * 100),
      stamps: stamps,
      pointsEarned: points,
      orders: orders,
      avgOrderCents: orders > 0 ? Math.round((sales * 100) / orders) : null,
      vouchersRedeemed: vouchersRedeemed,
      previous: {
        from: prevFromDate,
        visited: prevVisited.length,
        newCount: prevNew,
        returningCount: prevVisited.length - prevNew,
        salesCents: Math.round(prevSales * 100),
      },
    },
    trend: trend,
    topCustomers: topCustomers,
    inactive: inactive,
    attention: [
      { id: "return", title: "Bring customers back", detail: "Past their usual return window.", count: overdueCount },
      { id: "rewards", title: "Rewards ready", detail: "Valid voucher or 1-2 stamps from a reward.", count: rewardAudience },
      { id: "rebook", title: "Not rebooked yet", detail: "Previously booked, past the expected return date.", count: rebookCount },
    ],
    loyalty: { nearReward: nearReward, availableVouchers: availableVouchers, daily: daily },
    bookings: {
      completed: bookingCounts.completed || 0,
      upcoming: (bookingCounts.booked || 0) + (bookingCounts.arrived || 0) + (bookingCounts.in_service || 0),
      cancelled: bookingCounts.cancelled || 0,
      noShow: bookingCounts.no_show || 0,
      total: bookingTotal,
      nextBookingCustomers: futureBookingRows.length,
    },
    birthdays: birthdayCount,
    feedback: { responses: feedbackCount, avgRating: avgRating },
    unavailable: { googleReviewOpens: true, campaignResults: true, branchFeedback: true, availableSlots: true },
  };
}

/** Audience rows for the Actions cards. Paginated; counts live in the snapshot. */
function buildAudience($app, ctx, card, page, perPage) {
  const limit = Math.max(1, Math.min(50, Number(perPage) || 20));
  const offset = Math.max(0, (Math.max(1, Number(page) || 1) - 1) * limit);
  const nowUtc = utcNowString();
  const returnDays = Number(ctx.returnDays) > 0 ? Number(ctx.returnDays) : DEFAULT_RETURN_DAYS;
  const cutoff = new Date(Date.now() - returnDays * DAY_MS).toISOString().replace("T", " ").slice(0, 19);

  if (card === "all") {
    // The customer directory that used to live on the separate activity screen.
    // Merchant-wide (the directory is not period-scoped), most recent first.
    return {
      items: rows(
        $app,
        "SELECT u.id as id, u.name as name, u.phone as phone, MAX(t.created) as last_seen, COUNT(t.id) as visits " +
          "FROM loyalty_cards c JOIN users u ON u.id = c.customer " +
          "LEFT JOIN transactions t ON t.customer = c.customer AND t.merchant = c.merchant AND t.type <> 'adjust' " +
          "WHERE c.merchant = {:mid} GROUP BY u.id " +
          "ORDER BY last_seen DESC LIMIT {:limit} OFFSET {:offset}",
        { mid: ctx.merchantId, limit: limit, offset: offset },
        { id: "", name: "", phone: "", last_seen: "", visits: 0 }
      ).map(function (r) {
        const seen = parsePbDate(r.last_seen);
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          lastVisit: r.last_seen,
          visits: Number(r.visits) || 0,
          daysOverdue: seen === null ? null : Math.floor((Date.now() - seen) / DAY_MS),
        };
      }),
    };
  }

  if (card === "return" || card === "rebook") {
    const scope = "t.merchant = {:mid}" + branchClause(ctx, "t.branch") + " AND t.type <> 'adjust'";
    const base = bindBase(ctx);
    // "rebook" is the subset who have actually completed a booking before.
    const rebookClause =
      card === "rebook"
        ? " AND t.customer IN (SELECT b5.customer FROM service_bookings b5 WHERE b5.merchant = {:mid3} " +
          "AND b5.status = 'completed' AND b5.customer != '') "
        : "";
    const rowsOut = rows(
      $app,
      "SELECT u.id as id, u.name as name, u.phone as phone, MAX(t.created) as last_seen " +
        "FROM transactions t JOIN users u ON u.id = t.customer WHERE " + scope +
        rebookClause +
        // Already booked in? Then they are not someone to win back — matches the
        // overview count, which also excludes customers with a future booking.
        " AND t.customer NOT IN (SELECT b2.customer FROM service_bookings b2 " +
        "WHERE b2.merchant = {:mid2} AND b2.customer != '' AND b2.status IN ('booked','arrived','in_service') " +
        "AND b2.booking_date >= {:today}) " +
        " GROUP BY u.id HAVING MAX(t.created) < {:cutoff} ORDER BY MAX(t.created) ASC LIMIT {:limit} OFFSET {:offset}",
      Object.assign({}, base, {
        cutoff: cutoff,
        limit: limit,
        offset: offset,
        mid2: ctx.merchantId,
        mid3: ctx.merchantId,
        today: localDate(0),
      }),
      { id: "", name: "", phone: "", last_seen: "" }
    );
    return {
      items: rowsOut.map(function (r) {
        const seen = parsePbDate(r.last_seen);
        return {
          id: r.id,
          name: r.name,
          phone: r.phone,
          lastVisit: r.last_seen,
          daysOverdue: seen === null ? null : Math.floor((Date.now() - seen) / DAY_MS),
        };
      }),
    };
  }

  if (card === "rewards") {
    const rowsOut = rows(
      $app,
      "SELECT * FROM (" +
        "SELECT u.id as id, u.name as name, u.phone as phone, 'voucher' as reason FROM vouchers v " +
        "JOIN rewards r ON r.id = v.reward JOIN users u ON u.id = v.customer " +
        "WHERE r.merchant = {:mid} AND v.status = 'active' AND (v.expires_at IS NULL OR v.expires_at > {:now}) " +
        "UNION " +
        "SELECT u.id as id, u.name as name, u.phone as phone, 'near_reward' as reason FROM loyalty_cards c " +
        "JOIN loyalty_programs p ON p.id = c.program JOIN users u ON u.id = c.customer " +
        "WHERE p.merchant = {:mid2} AND c.status = 'active' AND p.stamp_goal > 0 " +
        "AND (p.stamp_goal - c.stamps_collected) BETWEEN 1 AND 2" +
        ") GROUP BY id ORDER BY name ASC LIMIT {:limit} OFFSET {:offset}",
      { mid: ctx.merchantId, mid2: ctx.merchantId, now: nowUtc, limit: limit, offset: offset },
      { id: "", name: "", phone: "", reason: "" }
    );
    return {
      items: rowsOut.map(function (r) {
        return { id: r.id, name: r.name, phone: r.phone, reason: r.reason };
      }),
    };
  }

  if (card === "birthday") {
    const offsets = [];
    for (let i = 0; i <= 7; i++) offsets.push(addDays(localDate(0), i).slice(5));
    const params = { mid: ctx.merchantId, limit: limit, offset: offset };
    const inClause = offsets
      .map(function (d, i) {
        params["d" + i] = d;
        return "{:d" + i + "}";
      })
      .join(",");
    const rowsOut = rows(
      $app,
      "SELECT u.id as id, u.name as name, u.phone as phone, u.birthday as birthday FROM loyalty_cards c " +
        "JOIN users u ON u.id = c.customer WHERE c.merchant = {:mid} AND u.birthday <> '' " +
        "AND substr(u.birthday, 6, 5) IN (" + inClause + ") GROUP BY u.id ORDER BY substr(u.birthday, 6, 5) ASC LIMIT {:limit} OFFSET {:offset}",
      params,
      { id: "", name: "", phone: "", birthday: "" }
    );
    return {
      items: rowsOut.map(function (r) {
        return { id: r.id, name: r.name, phone: r.phone, birthday: r.birthday ? String(r.birthday).slice(5, 10) : null };
      }),
    };
  }

  throw new Error("UNKNOWN_CARD");
}

module.exports = {
  buildSnapshot: buildSnapshot,
  buildAudience: buildAudience,
  localDate: localDate,
  localDateToUtcStart: localDateToUtcStart,
  addDays: addDays,
};
