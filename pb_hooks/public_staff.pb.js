// pb_hooks/public_staff.pb.js
// Public, minimal provider list for the customer booking PWA.
//
// `users` is not publicly readable, so the owner's avatar cannot be resolved
// with an `expand` client-side. This route resolves it with $app (which
// bypasses collection rules) and falls back to the linked user's photo when
// the staff row has none.

routerAdd("GET", "/api/risev/staff/public", (e) => {
  let q = {};
  try { q = e.requestInfo().query || {}; } catch (err) {}
  const merchantId = (q.merchant || q.m || "").trim();
  if (!merchantId) return e.json(400, { message: "merchant is required" });

  const out = [];
  try {
    const list = $app.findRecordsByFilter(
      "merchant_staff",
      "merchant = '" + merchantId + "' && is_active = true",
      "sort_order,created",
      100,
      0
    );

    list.forEach((staff) => {
      let name = (staff.getString("name") || "").trim();
      let avatarUrl = "";
      const staffAvatar = staff.getString("avatar") || "";
      if (staffAvatar) {
        avatarUrl = "/api/files/merchant_staff/" + staff.id + "/" + encodeURIComponent(staffAvatar);
      }

      const userId = staff.getString("user") || "";
      if (userId && (!name || !avatarUrl)) {
        try {
          const user = $app.findRecordById("users", userId);
          if (!name) name = (user.getString("name") || "").trim();
          if (!avatarUrl) {
            const userAvatar = user.getString("avatar") || "";
            if (userAvatar) {
              avatarUrl = "/api/files/users/" + user.id + "/" + encodeURIComponent(userAvatar);
            }
          }
        } catch (userErr) {}
      }

      out.push({
        id: staff.id,
        name: name || "Staff",
        role_title: staff.getString("role_title") || "",
        avatar_url: avatarUrl,
        user_id: userId,
      });
    });
  } catch (err) {
    console.log("[PUBLIC STAFF ERROR]", err.message || err);
  }

  return e.json(200, { staff: out });
});
