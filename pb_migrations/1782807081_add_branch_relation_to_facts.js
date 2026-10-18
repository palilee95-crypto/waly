/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  function addField(colName, field) {
    try {
      const col = app.findCollectionByNameOrId(colName);
      let has = false;
      try { if (col.fields.getByName(field.name)) has = true; } catch (e) {}
      if (!has) { col.fields.add(new Field(field)); app.save(col);
        console.log(`[MIGRATION] ${colName}.${field.name} added`); }
    } catch (err) {
      console.log(`[MIGRATION] ${colName}.${field.name}:`, err.message || err);
    }
  }

  const branchRel = (id) => ({
    id, name: "branch", type: "relation", system: false, required: false,
    presentable: false, collectionId: "pbc_branches0000",
    cascadeDelete: false, minSelect: 0, maxSelect: 1,
  });

  addField("transactions", branchRel("rel_branch_txn"));
  addField("vouchers",     branchRel("rel_branch_vch"));
  addField("redemptions",  branchRel("rel_branch_red"));
  addField("nfc_claims",   branchRel("rel_branch_nfc"));
  addField("nfc_claims", { id: "text_branch_name_nfc", name: "branch_name",
    type: "text", system: false, required: false, presentable: false });
  addField("nfc_claims", { id: "rel_voucher_nfc", name: "voucher",
    type: "relation", system: false, required: false, presentable: false,
    collectionId: "pbc_vouchers0", cascadeDelete: false, minSelect: 0, maxSelect: 1 });
  addField("nfc_claims", { id: "text_voucher_title_nfc", name: "voucher_title",
    type: "text", system: false, required: false, presentable: false });

  try {
    const tx = app.findCollectionByNameOrId("transactions");
    tx.indexes = tx.indexes || [];
    const idx = "CREATE INDEX IF NOT EXISTS idx_transactions_branch ON transactions(branch)";
    if (tx.indexes.indexOf(idx) === -1) { tx.indexes.push(idx); app.save(tx); }
  } catch (e) {}
  return null;
}, (app) => {
  // Remove the index BEFORE dropping the field it references.
  try {
    const tx = app.findCollectionByNameOrId("transactions");
    tx.indexes = (tx.indexes || []).filter(i => i.indexOf("idx_transactions_branch") === -1);
    app.save(tx);
  } catch (e) {}

  function rm(colName, name) {
    try {
      const col = app.findCollectionByNameOrId(colName);
      col.fields.removeByName(name);
      app.save(col);
    } catch (e) {}
  }
  rm("nfc_claims", "branch"); rm("nfc_claims", "branch_name");
  rm("nfc_claims", "voucher"); rm("nfc_claims", "voucher_title");
  rm("redemptions", "branch"); rm("vouchers", "branch"); rm("transactions", "branch");
  return null;
});
