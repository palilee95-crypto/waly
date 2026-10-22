// pb_hooks/receipt_public.pb.js
//
// Public, token-scoped read of a single receipt. The collection itself is
// restricted (see migration 1793000006): a receipt is shared by its unguessable
// share_token, and this route returns only the fields the receipt screen needs —
// never the customer's phone, account id, transaction id or claim id.

routerAdd("GET", "/api/risev/receipt/public", (e) => {
  try {
    const query = (e.requestInfo() && e.requestInfo().query) || {};
    const token = String(query.token || "").trim();

    if (!/^[A-Za-z0-9]{16,64}$/.test(token)) {
      return e.json(400, { message: "This receipt link is invalid." });
    }

    const rows = $app.findRecordsByFilter(
      "digital_receipts",
      `share_token = "${token}"`,
      "-created",
      1,
      0
    );
    const receipt = rows.length ? rows[0] : null;
    if (!receipt) {
      return e.json(404, { message: "Receipt not found." });
    }

    const status = receipt.getString("payment_status");
    const total = Number(receipt.get("total_amount")) || 0;
    // A paid receipt may legitimately be RM0.00 (voucher covered the bill); a
    // "recorded" one is only a receipt when money changed hands.
    if (status !== "paid" && !(status === "recorded" && total > 0)) {
      return e.json(404, { message: "Receipt not found." });
    }

    let merchantName = "";
    let merchantId = "";
    let merchantLogo = "";
    try {
      const merchant = $app.findRecordById("merchants", receipt.getString("merchant"));
      merchantName = merchant.getString("name") || "";
      merchantId = merchant.id;
      merchantLogo = merchant.getString("logo") || "";
    } catch (merchantErr) {}

    let items = [];
    try {
      const rawItems = receipt.getString("line_items");
      const parsed = rawItems && rawItems !== "null" ? JSON.parse(rawItems) : [];
      if (Array.isArray(parsed)) items = parsed.slice(0, 100);
    } catch (itemsErr) {}

    const numberOrZero = function (field) {
      const value = Number(receipt.get(field));
      return Number.isFinite(value) ? value : 0;
    };

    // Receipts written before the reward snapshot existed have no goal. Send null
    // so the screen falls back to the card instead of rendering "0/10".
    const goal = numberOrZero("stamp_goal");

    return e.json(200, {
      receipt: {
        receipt_number: receipt.getString("receipt_number"),
        created: receipt.getString("created"),
        merchant_name: merchantName,
        // A logo is public branding (the Explore page shows it), and the receipt
        // PDF draws it, so the id and file name travel with the payload.
        merchant_id: merchantId,
        merchant_logo: merchantLogo,
        branch_name: receipt.getString("branch_name"),
        customer_name: receipt.getString("customer_name"),
        staff_name: receipt.getString("staff_name"),
        line_items: items,
        subtotal: numberOrZero("subtotal"),
        discount_amount: numberOrZero("discount_amount"),
        total_amount: total,
        payment_method: receipt.getString("payment_method"),
        payment_status: status,
        stamps_earned: numberOrZero("stamps_earned"),
        stamps_before: goal ? numberOrZero("stamps_before") : null,
        stamps_balance: goal ? numberOrZero("stamps_balance") : null,
        stamp_goal: goal || null,
        reward_name: receipt.getString("reward_name")
      }
    });
  } catch (err) {
    console.log("[RECEIPT PUBLIC ERROR]", err.message || err);
    return e.json(500, { message: "Could not load this receipt." });
  }
});
