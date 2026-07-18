/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("sales_agents")

  // Allow public creation of sales agents
  collection.createRule = ""

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("sales_agents")

  // Restore to admin-only
  collection.createRule = null

  return app.save(collection)
})
