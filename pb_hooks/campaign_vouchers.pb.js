// pb_hooks/campaign_vouchers.pb.js
// Endpoint for merchants to batch auto-drop promotional campaign vouchers to customer wallets

routerAdd("POST", "/api/risev/merchant/campaigns/auto-drop", (e) => {
  const authRecord = e.auth;
  if (!authRecord) {
    return e.json(401, { message: "Unauthorized. Merchant login required." });
  }

  const userRole = authRecord.getString("role");
  if (userRole !== "merchant" && userRole !== "both") {
    return e.json(403, { message: "Forbidden. Merchant access required." });
  }

  let merchantId = authRecord.getString("merchant_id");
  if (!merchantId) {
    try {
      const owned = $app.findRecordsByFilter("merchants", `owner = "${authRecord.id}"`, "-created", 1, 0);
      if (owned.length > 0) merchantId = owned[0].id;
    } catch (err) {}
  }

  if (!merchantId) {
    return e.json(400, { message: "Account is not associated with any merchant." });
  }

  const body = e.requestInfo().body || {};
  const campaignId = (body.campaign_id || "").trim();
  const rewardId = (body.reward_id || "").trim();
  const prefix = ((body.prefix || "PROMO").toUpperCase().replace(/[^A-Z0-9]/g, "") || "PROMO");
  const discountType = body.discount_type || "amount";
  const discountValue = body.discount_value || "5";
  const minSpend = body.min_spend || "";
  const expiresAt = body.expires_at || body.end_date || new Date(Date.now() + 30 * 86400000).toISOString();
  let customerIds = Array.isArray(body.customer_ids) ? body.customer_ids.filter(Boolean) : [];

  // If specific customer IDs not provided, resolve by audience segment
  if (customerIds.length === 0) {
    const audience = body.audience || "all";
    try {
      if (audience === "all") {
        const cards = $app.findRecordsByFilter("loyalty_cards", `merchant = "${merchantId}"`, "-created", 5000, 0);
        const set = new Set();
        cards.forEach(c => {
          const cust = c.getString("customer");
          if (cust) set.add(cust);
        });
        customerIds = Array.from(set);
      } else if (audience === "spenders") {
        // Customers with highest points/stamps
        const cards = $app.findRecordsByFilter("loyalty_cards", `merchant = "${merchantId}" && stamps_collected >= 3`, "-stamps_collected", 2000, 0);
        customerIds = cards.map(c => c.getString("customer")).filter(Boolean);
      } else if (audience === "inactive") {
        // Inactive customers (>14 days no activity)
        const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().replace('T', ' ').substring(0, 19);
        const cards = $app.findRecordsByFilter("loyalty_cards", `merchant = "${merchantId}" && (last_activity < "${fourteenDaysAgo}" || last_activity = "")`, "-created", 2000, 0);
        customerIds = cards.map(c => c.getString("customer")).filter(Boolean);
      } else {
        // Fallback: all active loyalty cards
        const cards = $app.findRecordsByFilter("loyalty_cards", `merchant = "${merchantId}"`, "-created", 5000, 0);
        customerIds = cards.map(c => c.getString("customer")).filter(Boolean);
      }
    } catch (qErr) {
      console.log("Error querying target audience:", qErr.message || qErr);
    }
  }

  // Deduplicate customer IDs
  customerIds = Array.from(new Set(customerIds));

  if (customerIds.length === 0) {
    return e.json(200, {
      success: true,
      message: "No eligible customers found for auto-drop.",
      issued_count: 0,
      vouchers: []
    });
  }

  const voucherCol = $app.findCollectionByNameOrId("vouchers");
  const createdVouchers = [];

  for (let i = 0; i < customerIds.length; i++) {
    const custId = customerIds[i];
    try {
      const randSuffix = $security.randomString(5).toUpperCase();
      const code = `${prefix}-${randSuffix}`;

      const voucher = new Record(voucherCol);
      voucher.set("id", $security.randomString(15).toLowerCase());
      voucher.set("customer", custId);
      if (rewardId) {
        voucher.set("reward", rewardId);
      }
      voucher.set("code", code);
      voucher.set("status", "active");
      voucher.set("expires_at", expiresAt);
      
      const meta = {
        campaign_id: campaignId,
        discount_type: discountType,
        discount_value: discountValue,
        min_spend: minSpend,
        source: "campaign_auto_drop"
      };
      voucher.set("metadata", JSON.stringify(meta));

      $app.save(voucher);
      createdVouchers.push({ id: voucher.id, customer: custId, code: code });
    } catch (saveErr) {
      console.log(`Failed to create voucher for customer ${custId}:`, saveErr.message || saveErr);
    }
  }

  console.log(`[CAMPAIGN AUTO-DROP] Successfully issued ${createdVouchers.length} vouchers for campaign ${campaignId}`);

  return e.json(200, {
    success: true,
    message: `Successfully distributed ${createdVouchers.length} vouchers to customer wallets.`,
    issued_count: createdVouchers.length,
    vouchers: createdVouchers
  });
}, $apis.requireAuth("users"));
