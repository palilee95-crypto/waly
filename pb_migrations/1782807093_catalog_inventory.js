/// <reference path="../pb_data/types.d.ts" />
// Inventory is deliberately independent of booking capacity (total_units).
migrate((app) => {
  const merchant = app.findCollectionByNameOrId('merchants').id;
  const branch = app.findCollectionByNameOrId('branches').id;
  const services = app.findCollectionByNameOrId('merchant_services');
  const scoped = "@request.auth.id != '' && (merchant.owner = @request.auth.id || @request.auth.merchant_id = merchant.id)";
  const rel = (name, id, required) => ({name, type: 'relation', collectionId: id, maxSelect: 1, required: !!required});
  const timestamps = [{name:'created',type:'autodate',onCreate:true}, {name:'updated',type:'autodate',onCreate:true,onUpdate:true}];
  const categories = new Collection({name:'catalog_categories',type:'base',listRule:scoped,viewRule:scoped,createRule:scoped,updateRule:scoped + ' && @request.body.merchant:changed = false',deleteRule:scoped,fields:[rel('merchant',merchant,true),{name:'name',type:'text',required:true,max:100},{name:'sort_order',type:'number'},{name:'is_active',type:'bool'},...timestamps]});
  app.save(categories);
  const fields = [rel('catalog_category',categories.id,false),{name:'sku',type:'text'},{name:'barcode',type:'text'},{name:'unit',type:'text'},{name:'track_stock',type:'bool'},{name:'low_stock_threshold',type:'number',min:0},{name:'cost_price',type:'number',min:0},{name:'pos_enabled',type:'bool'},{name:'booking_enabled',type:'bool'}];
  for (const field of fields) services.fields.add(new Field(field));
  app.save(services);
  // Never infer stock quantities from legacy booking capacity.
  app.db().newQuery('UPDATE merchant_services SET pos_enabled = TRUE, booking_enabled = TRUE').execute();
  const inventoryRead = scoped + " && (@request.auth.branch = '' || branch = @request.auth.branch || merchant.owner = @request.auth.id)";
  app.save(new Collection({name:'inventory_balances',type:'base',listRule:inventoryRead,viewRule:inventoryRead,createRule:null,updateRule:null,deleteRule:null,fields:[rel('merchant',merchant,true),rel('branch',branch,false),rel('item',services.id,true),{name:'quantity',type:'number',min:0},...timestamps],indexes:['CREATE UNIQUE INDEX idx_inventory_item_branch ON inventory_balances (item, branch)']}));
  app.save(new Collection({name:'inventory_movements',type:'base',listRule:inventoryRead,viewRule:inventoryRead,createRule:null,updateRule:null,deleteRule:null,fields:[rel('merchant',merchant,true),rel('branch',branch,false),rel('item',services.id,true),{name:'quantity',type:'number',required:true},{name:'balance_after',type:'number',min:0},{name:'reason',type:'text',required:true,max:500},{name:'actor',type:'text',required:true},{name:'reference',type:'text',required:true,max:200},...timestamps],indexes:['CREATE UNIQUE INDEX idx_inventory_reference ON inventory_movements (merchant, reference)']}));
}, (app) => {
  // Rollback retains operational stock history rather than destroying audit data.
  throw new Error('Catalog inventory rollback requires an explicit data retention/export plan.');
});
