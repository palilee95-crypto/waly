/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const sinceDate = "2026-10-01 12:00:00";
    
    // Fetch completed NFC claims since the issue began
    const claims = app.findRecordsByFilter(
      "nfc_claims",
      `status = 'completed' && (completed_at >= '${sinceDate}' || created >= '${sinceDate}')`,
      "created",
      500,
      0
    );

    let insertedCount = 0;

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      const claimId = claim.id;

      // Check if a transaction for this claim already exists
      let alreadyExists = false;
      try {
        const checkResult = new DynamicModel({ cnt: 0 });
        app.db()
          .newQuery("SELECT COUNT(*) as cnt FROM transactions WHERE metadata LIKE {:pattern}")
          .bind({ pattern: `%"claim_id":"${claimId}"%` })
          .one(checkResult);
        if (Number(checkResult.cnt) > 0) {
          alreadyExists = true;
        }
      } catch (checkErr) {}

      if (alreadyExists) continue;

      // Resolve customer
      let customerId = claim.getString("customer");
      const cleanPhone = claim.getString("customer_phone");
      if (!customerId && cleanPhone) {
        const digits = cleanPhone.replace(/[^\d]/g, '');
        const localDigits = digits.startsWith('60') ? '0' + digits.slice(2) : digits;
        try {
          const u = app.findRecordsByFilter("users", `phone = '${cleanPhone}' || phone = '${digits}' || phone = '${localDigits}'`, "-created", 1, 0);
          if (u.length > 0) customerId = u[0].id;
        } catch (uErr) {}
      }

      if (!customerId) continue;

      const merchantId = claim.getString("merchant");
      const billAmount = Number(claim.get("bill_amount")) || 0;
      const stamps = parseInt(claim.get("stamp_amount")) || 1;
      const points = billAmount > 0 ? billAmount : (stamps * 10);
      const staffId = claim.getString("handled_by") || "";
      const staffName = claim.getString("staff_name") || "Staff";
      const branchName = claim.getString("branch_name") || "All Branches (HQ)";
      const branchId = claim.getString("branch") || "";
      const sessionCode = claim.getString("session_code") || "";

      // Resolve loyalty card
      let cardId = "";
      try {
        const cards = app.findRecordsByFilter("loyalty_cards", `customer = '${customerId}' && merchant = '${merchantId}'`, "-created", 1, 0);
        if (cards.length > 0) cardId = cards[0].id;
      } catch (cErr) {}

      // Verify staff exists in users collection to satisfy FK relation if present
      let validStaffId = "";
      if (staffId) {
        try {
          const st = app.findRecordById("users", staffId);
          if (st) validStaffId = st.id;
        } catch (stErr) {
          validStaffId = "";
        }
      }

      const completedAtRaw = claim.getString("completed_at") || claim.getString("created") || new Date().toISOString();
      const completedAt = completedAtRaw.replace('T', ' ').substring(0, 23) + (completedAtRaw.endsWith('Z') ? '' : 'Z');

      const txnId = $security.randomString(15).toLowerCase();
      const meta = {
        source: "nfc_claim_backfill",
        claim_id: claimId,
        session_code: sessionCode,
        staff_id: staffId,
        staff_name: staffName,
        branch_name: branchName,
        branch_id: branchId,
        backfilled_at: new Date().toISOString()
      };

      // Direct SQL insert to preserve historical completed_at timestamps
      app.db().newQuery(
        "INSERT INTO transactions (id, created, updated, customer, merchant, loyalty_card, type, points, stamps, bill_amount, metadata, staff) " +
        "VALUES ({:id}, {:created}, {:updated}, {:customer}, {:merchant}, {:card}, {:type}, {:points}, {:stamps}, {:bill}, {:meta}, {:staff})"
      ).bind({
        id: txnId,
        created: completedAt,
        updated: completedAt,
        customer: customerId,
        merchant: merchantId,
        card: cardId,
        type: "earn",
        points: points,
        stamps: stamps,
        bill: billAmount,
        meta: JSON.stringify(meta),
        staff: validStaffId
      }).execute();

      insertedCount++;
    }

    console.log(`[Migration] Successfully backfilled ${insertedCount} missing transaction records from NFC claims.`);
  } catch (err) {
    console.log("[Migration Error] Failed to backfill transactions:", err.message || err);
  }

  return null;
}, (app) => {
  return null;
});
