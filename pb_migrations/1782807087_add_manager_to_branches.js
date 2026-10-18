/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    let has = false;
    try { if (col.fields.getByName("manager")) has = true; } catch (e) {}
    if (!has) {
      col.fields.add(new Field({
        id: "rel_manager_br",
        name: "manager",
        type: "relation",
        system: false,
        required: false,
        presentable: false,
        collectionId: "_pb_users_auth_",
        cascadeDelete: false,
        minSelect: 0,
        maxSelect: 1,
      }));
      app.save(col);
      console.log("[MIGRATION] Added branches.manager relation");
    }
  } catch (err) {
    console.log("[MIGRATION] branches.manager:", err.message || err);
  }
  return null;
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("branches");
    col.fields.removeByName("manager");
    app.save(col);
  } catch (e) {}
  return null;
});
