// Keeps a `merchant_staff` row for each merchant owner so the owner can be
// chosen as a provider on the public booking page (service_bookings.staff is a
// relation to merchant_staff, not to users).

onRecordCreate((e) => {
  e.next();
  try {
    const helper = require(`${__hooks}/owner_staff_helper.js`);
    helper.ensureOwnerStaff($app, e.record);
  } catch (err) {
    console.log("[OWNER STAFF] Hook failed:", err && err.message ? err.message : err);
  }
}, "merchants");

onRecordUpdate((e) => {
  let previousOwner = "";
  try {
    previousOwner = e.record.original().getString("owner") || "";
  } catch (err) {}

  e.next();

  try {
    const currentOwner = e.record.getString("owner") || "";
    if (!currentOwner || currentOwner === previousOwner) return;
    const helper = require(`${__hooks}/owner_staff_helper.js`);
    helper.ensureOwnerStaff($app, e.record);
  } catch (err) {
    console.log("[OWNER STAFF] Hook failed:", err && err.message ? err.message : err);
  }
}, "merchants");
