// pb_hooks/cascade_delete_user.pb.js
// Cascade-delete all user-dependent data when a user is deleted.
// Order matters: merchant-dependent records must be deleted BEFORE the merchant,
// otherwise PocketBase blocks with "part of a required reference".

onRecordDelete((e) => {
    const userId = e.record.id;

    // Helper: fetch + delete all records in `collection` where `field` = userId
    const deleteByUser = (collection, field) => {
        try {
            const records = $app.findRecordsByFilter(collection, `${field} = '${userId}'`);
            for (const rec of records) {
                $app.delete(rec);
            }
        } catch (err) {
            console.log(`Error deleting ${collection} (${field}=${userId}): ${err}`);
        }
    };

    // Helper: fetch + delete all records in `collection` where `field` = merchantId
    const deleteByMerchant = (collection, field, merchantId) => {
        try {
            const records = $app.findRecordsByFilter(collection, `${field} = '${merchantId}'`);
            for (const rec of records) {
                $app.delete(rec);
            }
        } catch (err) {
            console.log(`Error deleting ${collection} (${field}=${merchantId}): ${err}`);
        }
    };

    // ---- Step 1: Find merchant(s) owned by this user ----
    let merchantIds = [];
    try {
        const merchants = $app.findRecordsByFilter("merchants", `owner = '${userId}'`);
        for (const m of merchants) {
            merchantIds.push(m.id);
        }
    } catch (err) {
        console.log(`Error finding merchants for user ${userId}: ${err}`);
    }

    // ---- Step 2: Delete records that reference the merchant (required refs) ----
    // These must be deleted BEFORE the merchant itself.
    const merchantDependents = [
        { collection: "campaigns", field: "merchant" },
        { collection: "loyalty_programs", field: "merchant" },
        { collection: "loyalty_cards", field: "merchant" },
        { collection: "rewards", field: "merchant" },
        { collection: "transactions", field: "merchant" },
        { collection: "store_locations", field: "merchant" },
        { collection: "follow_up_groups", field: "merchant" },
        { collection: "commissions", field: "referred_merchant" },
        { collection: "automation_rules", field: "merchant" },
        { collection: "broadcasts", field: "merchant" },
        { collection: "subscriptions", field: "merchant" },
    ];

    for (const mid of merchantIds) {
        for (const dep of merchantDependents) {
            deleteByMerchant(dep.collection, dep.field, mid);
        }
    }

    // ---- Step 3: Delete the merchant record(s) ----
    // Now that nothing references it, this should succeed.
    for (const mid of merchantIds) {
        try {
            const m = $app.findRecordById("merchants", mid);
            if (m) $app.delete(m);
        } catch (err) {
            console.log(`Error deleting merchant ${mid}: ${err}`);
        }
    }

    // ---- Step 4: Delete user-dependent records (no merchant dependency) ----
    // Removed deleted collections: notifications, push_tokens, user_badges,
    // user_challenges, streaks, tier_history
    const userDependents = [
        { collection: "redemptions", field: "customer" },
        { collection: "loyalty_cards", field: "customer" },
        { collection: "transactions", field: "customer" },
        { collection: "vouchers", field: "customer" },
        { collection: "fraud_flags", field: "user" },
        { collection: "follow_up_logs", field: "customer" },
        { collection: "follow_up_members", field: "customer" },
        { collection: "qr_transactions", field: "customer" },
    ];

    for (const dep of userDependents) {
        deleteByUser(dep.collection, dep.field);
    }

    return e.next();
}, "users");