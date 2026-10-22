/// <reference path="../pb_data/types.d.ts" />
// Snapshot the card progress on the paid receipt so customers and staff see the
// real reward balance even after the card changes later.
migrate((app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    const fields = [
      { id: "num_receipt_stamps_before", name: "stamps_before", type: "number" },
      { id: "num_receipt_stamps_balance", name: "stamps_balance", type: "number" },
      { id: "num_receipt_stamp_goal", name: "stamp_goal", type: "number" },
      { id: "text_receipt_reward_name", name: "reward_name", type: "text" },
    ];
    let added = false;
    for (const field of fields) {
      let exists = false;
      try { exists = !!receipts.fields.getByName(field.name); } catch (err) { exists = false; }
      if (!exists) {
        receipts.fields.add(new Field({ system: false, required: false, presentable: false, ...field }));
        added = true;
      }
    }
    if (added) {
      app.save(receipts);
      console.log("[MIGRATION 1793000005] Added reward progress columns to digital_receipts");
    }
  } catch (err) {
    // Do not swallow: the receipt writers below depend on these columns, and a
    // silent skip would make every reward snapshot vanish (unknown fields are
    // dropped without an error). Failing here is loud and fixable.
    console.log("[MIGRATION 1793000005 ERROR]", err.message || err);
    throw err;
  }
}, (app) => {
  try {
    const receipts = app.findCollectionByNameOrId("digital_receipts");
    for (const name of ["stamps_before", "stamps_balance", "stamp_goal", "reward_name"]) {
      try { receipts.fields.removeByName(name); } catch (err) {}
    }
    app.save(receipts);
  } catch (err) {}
});
