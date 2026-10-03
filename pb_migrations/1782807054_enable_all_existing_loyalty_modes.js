/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    // In SQLite / PocketBase, newly added boolean fields defaulted to 0 (false).
    // Set all existing loyalty programs to have both enable_stamps = 1 and enable_points = 1.
    app.db()
      .newQuery("UPDATE loyalty_programs SET enable_stamps = 1, enable_points = 1")
      .execute();
    console.log("[MIGRATION 1782807054] Successfully updated enable_stamps = 1 and enable_points = 1 for all existing programs.");
  } catch (err) {
    console.log("[MIGRATION 1782807054] Error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
