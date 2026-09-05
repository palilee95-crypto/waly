/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const txnCol = app.findCollectionByNameOrId("transactions");
    const usersCol = app.findCollectionByNameOrId("_pb_users_auth_");
    
    // 1. Add staff relation field if not present
    let hasStaffField = false;
    try {
      hasStaffField = !!txnCol.fields.getByName("staff");
    } catch (e) {
      hasStaffField = false;
    }

    if (!hasStaffField) {
      txnCol.fields.addAt(
        txnCol.fields.length,
        new Field({
          "id": "rel_txn_staff",
          "name": "staff",
          "type": "relation",
          "system": false,
          "required": false,
          "presentable": false,
          "collectionId": usersCol.id,
          "cascadeDelete": false,
          "minSelect": 0,
          "maxSelect": 1
        })
      );
      app.save(txnCol);
      console.log("[Migration] Added staff relation field to transactions collection");
    }

    // 2. Add index for staff lookups if not present
    const staffIndex = "CREATE INDEX IF NOT EXISTS idx_transactions_staff ON transactions(staff)";
    const existingIndexes = txnCol.indexes || [];
    if (!existingIndexes.includes(staffIndex)) {
      txnCol.indexes.push(staffIndex);
      app.save(txnCol);
      console.log("[Migration] Added idx_transactions_staff index to transactions");
    }
  } catch (err) {
    console.log("[Migration] Error adding staff to transactions:", err.message || err);
  }

  return null;
}, (app) => {
  try {
    const txnCol = app.findCollectionByNameOrId("transactions");
    try {
      txnCol.fields.removeByName("staff");
      app.save(txnCol);
    } catch (e) {}
  } catch (err) {}
  return null;
});
