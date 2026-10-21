// pb_hooks/public_customer_lookup.pb.js
// Name lookup for the public booking page.
//
// Deliberately NOT a global phone book: a name is only returned when that phone
// already has a loyalty card or a booking at the merchant being booked. That
// lets returning customers skip retyping their name without turning the
// endpoint into a way to resolve any phone number to a person.

routerAdd("GET", "/api/risev/booking/customer-lookup", (e) => {
  let q = {};
  try { q = e.requestInfo().query || {}; } catch (err) {}

  const merchantId = String(q.merchant || q.m || "").trim();
  const rawPhone = String(q.phone || "").replace(/[^\d]/g, "");
  if (!merchantId || !rawPhone) {
    return e.json(400, { message: "merchant and phone are required" });
  }

  const plus = rawPhone.indexOf("60") === 0 ? "+" + rawPhone : "+60" + rawPhone.replace(/^0/, "");
  const local = rawPhone.indexOf("60") === 0 ? "0" + rawPhone.slice(2) : rawPhone;
  const result = { exists: false, name: "" };

  let related = false;
  try {
    const cards = $app.findRecordsByFilter(
      "loyalty_cards",
      "merchant = '" + merchantId + "' && (customer.phone = '" + plus + "' || customer.phone = '" + local + "' || customer.phone = '" + rawPhone + "')",
      "created",
      1,
      0
    );
    if (cards.length > 0) related = true;
  } catch (cardErr) {}

  if (!related) {
    try {
      const bookings = $app.findRecordsByFilter(
        "service_bookings",
        "merchant = '" + merchantId + "' && (customer_phone = '" + plus + "' || customer_phone = '" + local + "' || customer_phone = '" + rawPhone + "')",
        "-created",
        1,
        0
      );
      if (bookings.length > 0) related = true;
    } catch (bookingErr) {}
  }

  if (!related) return e.json(200, result);

  try {
    const users = $app.findRecordsByFilter(
      "users",
      "phone = '" + plus + "' || phone = '" + local + "' || phone = '" + rawPhone + "'",
      "-created",
      1,
      0
    );
    if (users.length > 0) {
      result.exists = true;
      result.name = (users[0].getString("name") || "").trim();
    }
  } catch (userErr) {
    console.log("[PUBLIC CUSTOMER LOOKUP ERROR]", userErr.message || userErr);
  }

  return e.json(200, result);
});
