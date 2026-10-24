/// <reference path="../pb_data/types.d.ts" />
// Staff employment, pay and attendance were read all over the app
// (staff_management GET, booking_helper commission, the staff edit screen) but
// never existed as columns, so every read silently fell back to full_time / 0
// and every write was dropped. They live on `users`, NOT `merchant_staff`:
// merchant_staff is world-readable (listRule/viewRule are ""), so pay there
// would leak to anyone.
migrate((app) => {
  try {
    const users = app.findCollectionByNameOrId("users");

    const addField = (config) => {
      let exists = false;
      try { exists = !!users.fields.getByName(config.name); } catch (err) { exists = false; }
      if (exists) return false;
      users.fields.add(new Field(config));
      return true;
    };

    addField({
      id: "sel_emp_type_user",
      name: "employment_type",
      type: "select",
      required: false,
      system: false,
      maxSelect: 1,
      values: ["full_time", "part_time"],
    });
    addField({
      id: "num_base_salary_user",
      name: "base_salary",
      type: "number",
      required: false,
      system: false,
      min: 0,
      max: null,
      onlyInt: false,
    });
    addField({
      id: "num_hourly_rate_user",
      name: "hourly_rate",
      type: "number",
      required: false,
      system: false,
      min: 0,
      max: null,
      onlyInt: false,
    });
    addField({
      id: "sel_comm_type_user",
      name: "commission_type",
      type: "select",
      required: false,
      system: false,
      maxSelect: 1,
      values: ["none", "percentage", "fixed_per_job"],
    });
    addField({
      id: "num_comm_rate_user",
      name: "commission_rate",
      type: "number",
      required: false,
      system: false,
      min: 0,
      max: null,
      onlyInt: false,
    });
    addField({
      id: "sel_attendance_user",
      name: "attendance_status",
      type: "select",
      required: false,
      system: false,
      maxSelect: 1,
      values: ["active", "on_leave"],
    });
    addField({
      id: "text_leave_reason_user",
      name: "leave_reason",
      type: "text",
      required: false,
      system: false,
      max: 500,
    });
    addField({
      id: "text_leave_at_user",
      name: "leave_updated_at",
      type: "text",
      required: false,
      system: false,
      max: 40,
    });

    app.save(users);
    console.log("[MIGRATION 1793000013] Added staff employment/pay fields to users");
  } catch (err) {
    console.log("[MIGRATION 1793000013 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const users = app.findCollectionByNameOrId("users");
    ["employment_type", "base_salary", "hourly_rate", "commission_type", "commission_rate", "attendance_status", "leave_reason", "leave_updated_at"]
      .forEach(function (name) {
        try { users.fields.removeByName(name); } catch (err) {}
      });
    app.save(users);
  } catch (err) {
    console.log("[MIGRATION 1793000013 DOWN ERROR]", err.message || err);
  }
});
