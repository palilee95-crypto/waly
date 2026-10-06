/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const serviceBookings = app.findCollectionByNameOrId("service_bookings");
    serviceBookings.listRule = "customer = @request.auth.id || customer_phone = @request.auth.phone || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')";
    serviceBookings.viewRule = "customer = @request.auth.id || customer_phone = @request.auth.phone || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')";
    serviceBookings.updateRule = "customer = @request.auth.id || customer_phone = @request.auth.phone || merchant.owner = @request.auth.id || (merchant.id = @request.auth.merchant_id && @request.auth.merchant_id != '')";
    app.save(serviceBookings);
    console.log("[MIGRATION 1782807058] Successfully allowed customers to view and update service_bookings");
  } catch (err) {
    console.log("[MIGRATION 1782807058 ERROR]", err.message || err);
  }
}, (app) => {
  try {
    const serviceBookings = app.findCollectionByNameOrId("service_bookings");
    serviceBookings.listRule = "@request.auth.id != '' && (@request.auth.merchant_id = merchant.id || merchant.owner = @request.auth.id)";
    serviceBookings.viewRule = "";
    serviceBookings.updateRule = "";
    app.save(serviceBookings);
  } catch (err) {}
});
