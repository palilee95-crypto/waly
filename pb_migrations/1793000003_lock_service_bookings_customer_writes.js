/// <reference path="../pb_data/types.d.ts" />
// Customers no longer write service_bookings directly. Arrival now goes through
// POST /api/risev/booking/check-in, which validates ownership, booking status
// and the same-store-day window. Without this lock a customer could PATCH
// status="completed" and mint themselves stamps, points, commission and a
// receipt (processCompletedBooking fires on that transition).
migrate((app) => {
  try {
    const serviceBookings = app.findCollectionByNameOrId("service_bookings");
    serviceBookings.updateRule =
      "merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')";
    app.save(serviceBookings);
    console.log("[MIGRATION 1793000003] Locked service_bookings writes to merchant owners and staff");
  } catch (err) {
    console.log("[MIGRATION 1793000003 ERROR]", err.message || err);
  }
}, (app) => {
  try {
    const serviceBookings = app.findCollectionByNameOrId("service_bookings");
    serviceBookings.updateRule =
      "customer = @request.auth.id || customer_phone = @request.auth.phone || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')";
    app.save(serviceBookings);
  } catch (err) {}
});
