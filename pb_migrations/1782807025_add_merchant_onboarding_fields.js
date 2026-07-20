/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const col = app.findCollectionByNameOrId("pbc_merchants00");

  col.fields.addAt(col.fields.length,
    new Field({
      "id": "text_onb_welcome",
      "name": "onboarding_welcome_text",
      "type": "text",
      "system": false,
      "required": false
    })
  );
  col.fields.addAt(col.fields.length,
    new Field({
      "id": "text_onb_primary",
      "name": "onboarding_primary_color",
      "type": "text",
      "system": false,
      "required": false
    })
  );
  col.fields.addAt(col.fields.length,
    new Field({
      "id": "text_onb_bg",
      "name": "onboarding_bg_color",
      "type": "text",
      "system": false,
      "required": false
    })
  );

  return app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("pbc_merchants00");
  col.fields.removeById("text_onb_welcome");
  col.fields.removeById("text_onb_primary");
  col.fields.removeById("text_onb_bg");
  return app.save(col);
})