// pb_hooks/customer_management.pb.js
// Endpoints for merchant to manage their customer records (e.g., updating customer name, phone, notes)

routerAdd("POST", "/api/risev/merchant/customer/update", (e) => {
  try {
    const authRecord = e.auth;
    if (!authRecord) {
      return e.json(401, { message: "Unauthorized. Please log in first." });
    }

    let merchantId = authRecord.getString("merchant_id");
    if (!merchantId) {
      const merchants = $app.findRecordsByFilter("merchants", `owner = '${authRecord.id}'`, "created", 1, 0);
      if (merchants.length > 0) merchantId = merchants[0].id;
    }

    if (!merchantId) {
      return e.json(400, { message: "No merchant profile associated with logged in account." });
    }

    const body = e.requestInfo().body || {};
    const customerId = (body.customer_id || body.id || "").trim();
    const newName = (body.name || "").trim();
    const rawPhone = (body.phone || "").trim();

    if (!customerId) {
      return e.json(400, { message: "Customer ID is required." });
    }

    if (!newName) {
      return e.json(400, { message: "Customer name cannot be empty." });
    }

    // Find customer record
    let customer = null;
    try {
      customer = $app.findRecordById("users", customerId);
    } catch (err) {
      return e.json(404, { message: "Customer record not found." });
    }

    // Update name
    customer.set("name", newName);

    // If phone is provided, format and update phone
    if (rawPhone) {
      let digits = rawPhone.replace(/[^\d]/g, '');
      if (digits.startsWith('0')) digits = '6' + digits;
      if (!digits.startsWith('60') && digits.length >= 9) digits = '60' + digits;
      const cleanPhone = '+' + digits;

      const currentPhone = customer.getString("phone");
      if (currentPhone !== cleanPhone) {
        // Check if another user already has this phone number
        const existingUsers = $app.findRecordsByFilter(
          "users",
          `phone = '${cleanPhone}' && id != '${customerId}'`,
          "created",
          1,
          0
        );

        if (existingUsers.length > 0) {
          return e.json(400, { message: "Phone number is already in use by another customer." });
        }

        customer.set("phone", cleanPhone);

        // If it's a shadow user, also update email to match new phone
        const currentEmail = customer.getString("email");
        if (currentEmail && currentEmail.startsWith("shadow_cust_")) {
          customer.set("email", `shadow_cust_${digits}@risev.app`);
        }
      }
    }

    $app.save(customer);

    console.log(`[CUSTOMER MANAGEMENT] Merchant ${merchantId} updated customer ${customerId} -> Name: "${newName}"`);

    return e.json(200, {
      success: true,
      message: "Customer information updated successfully.",
      customer: {
        id: customer.id,
        name: customer.getString("name"),
        phone: customer.getString("phone"),
      }
    });
  } catch (err) {
    console.log("[CUSTOMER MANAGEMENT] Error updating customer:", err.message || err);
    return e.json(500, { message: "Failed to update customer: " + (err.message || err) });
  }
});
