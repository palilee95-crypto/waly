// Paid receipt recovery/creation for NFC claims.
//
// This lives in a required module because PocketBase JSVM handlers do not see
// file-level functions from their .pb.js file. The helper uses the global
// $app, exactly like booking_helper.js.
function ensureNfcPaidReceipt(claim, transaction, checkout) {
  const claimId = claim.id;
  const merchantId = claim.getString("merchant");
  const matches = $app.findRecordsByFilter("digital_receipts", "claim = '" + claimId + "'", "-created", 1, 0);
  if (matches.length) return matches[0].id;

  let txn = transaction || null;
  let sourceOverride = checkout || null;
  if (!txn) {
    const bookings = $app.findRecordsByFilter(
      "service_bookings",
      "merchant = '" + merchantId + "' && metadata ~ '\"pos_claim_id\":\"" + claimId + "\"'",
      "-created",
      10,
      0
    );
    const booking = bookings.find(function (item) {
      try {
        return JSON.parse(item.getString("metadata") || "{}").pos_claim_id === claimId && item.getString("status") === "completed";
      } catch (err) {
        return false;
      }
    });
    if (booking) {
      const bookedReceipts = $app.findRecordsByFilter("digital_receipts", "booking = '" + booking.id + "'", "-created", 1, 0);
      if (bookedReceipts.length) {
        const receipt = bookedReceipts[0];
        receipt.set("claim", claimId);
        receipt.set("payment_status", "paid");
        $app.save(receipt);
        return receipt.id;
      }
      const bookingLedger = $app.findRecordsByFilter(
        "transactions",
        "merchant = '" + merchantId + "' && metadata ~ '\"booking_id\":\"" + booking.id + "\"'",
        "-created",
        10,
        0
      );
      txn = bookingLedger.find(function (item) {
        try {
          return JSON.parse(item.getString("metadata") || "{}").booking_id === booking.id;
        } catch (err) {
          return false;
        }
      }) || null;
      const bookingMeta = JSON.parse(booking.getString("metadata") || "{}");
      let bookingItems = [];
      try {
        bookingItems = JSON.parse(booking.getString("items_summary") || "[]");
      } catch (err) {}
      sourceOverride = Object.assign({}, bookingMeta, { items: bookingItems });
    }
  }

  if (!txn) {
    const ledger = $app.findRecordsByFilter(
      "transactions",
      "merchant = '" + merchantId + "' && metadata ~ '\"claim_id\":\"" + claimId + "\"'",
      "-created",
      10,
      0
    );
    txn = ledger.find(function (item) {
      try {
        const meta = JSON.parse(item.getString("metadata") || "{}");
        return meta.claim_id === claimId && meta.source === "nfc_claim";
      } catch (err) {
        return false;
      }
    }) || null;
  }
  if (!txn) throw new Error("The paid transaction for this claim was not found.");

  const amount = Number(claim.get("bill_amount")) || Number(txn.get("bill_amount")) || 0;

  let meta = {};
  try {
    // Unset JSON reads back as "null" → JSON.parse gives null, not an object.
    const rawMeta = txn.getString("metadata") || "";
    const parsedMeta = rawMeta && rawMeta !== "null" ? JSON.parse(rawMeta) : null;
    if (parsedMeta && typeof parsedMeta === "object" && !Array.isArray(parsedMeta)) meta = parsedMeta;
  } catch (err) {}
  const source = sourceOverride || meta;
  const rawItems = Array.isArray(source.items)
    ? source.items
    : (Array.isArray(meta.items_summary) ? meta.items_summary : []);
  const grossAmount = Number(source.subtotal) || rawItems.reduce(function (sum, item) {
    return sum + Math.max(0, Number(item.price) || 0) * Math.max(1, Number(item.qty) || 1);
  }, 0);
  const voucherApplied = Boolean(meta.voucher_id || source.voucher_id) &&
    !meta.voucher_error && !source.voucher_error;
  if (amount <= 0 && !(voucherApplied && grossAmount > 0)) return "";
  const items = rawItems.slice(0, 100).map(function (item) {
    return {
      name: String(item.name || "Item").slice(0, 120),
      qty: Math.max(1, Math.min(999, parseInt(item.qty, 10) || 1)),
      price: Math.max(0, Number(item.price) || 0),
    };
  }).filter(function (item) {
    return item.name;
  });
  if (!items.length) {
    items.push({ name: "Counter payment", qty: 1, price: Number(source.subtotal) || amount });
  }
  const subtotal = Math.max(
    0,
    Number(source.subtotal) ||
      items.reduce(function (sum, item) {
        return sum + item.price * item.qty;
      }, 0)
  );
  const discount = meta.voucher_error ? 0 : Math.max(0, Number(source.discount_amount) || 0);

  const receipt = new Record($app.findCollectionByNameOrId("digital_receipts"));
  receipt.set("merchant", merchantId);
  receipt.set("claim", claimId);
  receipt.set("transaction", txn.id);
  receipt.set("customer", txn.getString("customer") || claim.getString("customer"));
  receipt.set("customer_phone", claim.getString("customer_phone"));
  receipt.set("customer_name", claim.getString("customer_name") || "Customer");
  receipt.set("staff_name", meta.staff_name || claim.getString("staff_name") || "");
  receipt.set("branch_name", meta.branch_name || claim.getString("branch_name") || "");
  receipt.set("receipt_number", "RV-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + txn.id.slice(-6).toUpperCase());
  receipt.set("line_items", items);
  receipt.set("subtotal", subtotal);
  receipt.set("discount_amount", discount);
  receipt.set("total_amount", amount);
  receipt.set("payment_method", String(source.payment_method || "Counter"));
  receipt.set("payment_reference", String(source.payment_reference || "").slice(0, 120));
  receipt.set("payment_status", "paid");
  receipt.set("stamps_earned", Number(txn.get("stamps")) || 0);
  try {
    const cardId = txn.getString("loyalty_card");
    if (cardId) {
      const card = $app.findRecordById("loyalty_cards", cardId);
      const earnedStamps = Number(txn.get("stamps")) || 0;
      const balance = Math.max(0, Number(card.get("stamps_collected")) || 0);
      let goal = 10;
      let rewardName = "";
      try {
        const program = $app.findRecordById("loyalty_programs", card.getString("program"));
        goal = Math.max(1, Number(program.get("stamp_goal")) || 10);
        // Name the REWARD, not the card ("Free Reward", not "Standard Loyalty
        // Card") — manual-give receipts read the same field.
        rewardName = String(program.getString("reward_name") || "").slice(0, 120);
        if (!rewardName) {
          try {
            const rewardId = program.getString("linked_reward");
            if (rewardId) {
              rewardName = String($app.findRecordById("rewards", rewardId).getString("name") || "").slice(0, 120);
            }
          } catch (rewardLookupErr) {}
        }
      } catch (programErr) {}
      // A card that just completed its goal is reset before this snapshot runs.
      // Read live, a 9/10 -> 10/10 visit looks like "0 before, 0 after"; the
      // receipt must instead show the balance the visit reached.
      const completedCard = earnedStamps > 0 && balance < earnedStamps;
      const stampsBefore = completedCard
        ? Math.max(0, goal - earnedStamps)
        : Math.max(0, balance - earnedStamps);
      receipt.set("stamps_before", stampsBefore);
      receipt.set("stamps_balance", completedCard ? goal : balance);
      receipt.set("stamp_goal", goal);
      receipt.set("reward_name", rewardName);
    }
  } catch (rewardErr) {
    console.log("[PAID RECEIPT] reward snapshot failed:", rewardErr.message || rewardErr);
  }
  $app.save(receipt);
  return receipt.id;
}

module.exports = {
  ensureNfcPaidReceipt: ensureNfcPaidReceipt,
};
