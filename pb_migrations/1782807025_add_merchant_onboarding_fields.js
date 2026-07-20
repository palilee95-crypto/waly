/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("pbc_merchants00");

    try {
      col.fields.addAt(col.fields.length,
        new Field({
          "id": "text_onb_welcome",
          "name": "onboarding_welcome_text",
          "type": "text",
          "system": false,
          "required": false
        })
      );
    } catch (e) {}
    try {
      col.fields.addAt(col.fields.length,
        new Field({
          "id": "text_onb_primary",
          "name": "onboarding_primary_color",
          "type": "text",
          "system": false,
          "required": false
        })
      );
    } catch (e) {}
    try {
      col.fields.addAt(col.fields.length,
        new Field({
          "id": "text_onb_bg",
          "name": "onboarding_bg_color",
          "type": "text",
          "system": false,
          "required": false
        })
      );
    } catch (e) {}

    return app.save(col);
  } catch (err) {
    console.log("Skip onboarding fields migration: " + (err.message || err));
    return null;
  }
}, (app) => {
  return null;
})