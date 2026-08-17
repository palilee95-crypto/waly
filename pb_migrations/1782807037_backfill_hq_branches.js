/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const branchCol = app.findCollectionByNameOrId("branches");
    const merchants = app.findRecordsByFilter("merchants", "1=1", "-created", 1000, 0);
    
    console.log(`[BACKFILL HQ] Found ${merchants.length} merchants to check for default HQ branches...`);
    let createdCount = 0;

    for (let i = 0; i < merchants.length; i++) {
      const m = merchants[i];
      try {
        const existingBranches = app.findRecordsByFilter("branches", `merchant = "${m.id}"`, "-created", 1, 0);
        if (existingBranches.length === 0) {
          // Find merchant owner details if available
          let ownerName = "Store Owner";
          let ownerPhone = m.getString("phone") || "";
          const ownerId = m.getString("owner");
          if (ownerId) {
            try {
              const ownerRec = app.findRecordById("users", ownerId);
              if (ownerRec) {
                ownerName = ownerRec.getString("name") || ownerName;
                if (!ownerPhone) ownerPhone = ownerRec.getString("phone") || "";
              }
            } catch (oErr) {}
          }

          const branch = new Record(branchCol);
          branch.set("id", $security.randomString(15).toLowerCase());
          branch.set("merchant", m.id);
          branch.set("name", m.getString("name") ? `${m.getString("name")} (HQ)` : "Main Outlet (HQ)");
          branch.set("address", m.getString("address") || "");
          branch.set("city", m.getString("city") || "Malaysia");
          branch.set("phone", ownerPhone);
          branch.set("manager_name", ownerName);
          branch.set("is_hq", true);
          branch.set("status", "active");

          app.save(branch);
          createdCount++;
          console.log(`[BACKFILL HQ] Created HQ branch for merchant ${m.id} (${m.getString("name")})`);
        }
      } catch (mErr) {
        console.log(`[BACKFILL HQ ERROR] Failed for merchant ${m.id}:`, mErr.message || mErr);
      }
    }

    console.log(`[BACKFILL HQ COMPLETE] Successfully created ${createdCount} HQ branches for existing merchants.`);
  } catch (err) {
    console.log("[BACKFILL HQ] Migration skipped or error:", err.message || err);
  }
  return null;
}, (app) => {
  return null;
});
