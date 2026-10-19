routerAdd('POST', '/api/risev/inventory/adjust', (e) => {
  if (!e.auth) return e.json(401,{message:'Authentication required'});
  const helper = require(__hooks + '/inventory_helper.js');
  const body = e.requestInfo().body || {};
  const merchantId = String(body.merchant_id || '').trim();
  const branchId = String(body.branch_id || '').trim();
  try {
    helper.authorize($app,e.auth,merchantId,branchId);
  } catch (err) { return e.json(403,{message:'Merchant or branch access denied'}); }
  try {
    let result;
    $app.runInTransaction((app) => {
      result = helper.adjust(app,e.auth,merchantId,branchId,String(body.item_id || ''),Number(body.quantity),String(body.reason || '').trim(),String(body.idempotency_key || '').trim());
    });
    return e.json(200,{success:true,...result});
  } catch(err) { return e.json(400,{message:String(err.message || err)}); }
});
// Protect catalog ownership and stock semantics even for direct collection writes.
onRecordCreateRequest((e) => {
  const record = e.record;
  const cat = record.getString('catalog_category');
  if (cat && $app.findRecordById('catalog_categories',cat).getString('merchant') !== record.getString('merchant')) throw new BadRequestError('Category belongs to another merchant');
  if (record.getBool('track_stock') && ['product','addon'].indexOf(record.getString('item_type')) < 0) throw new BadRequestError('Stock tracking is only available for physical products');
  e.next();
},'merchant_services');
onRecordUpdateRequest((e) => {
  const record = e.record;
  if (record.original().getString('merchant') !== record.getString('merchant')) throw new BadRequestError('Item merchant cannot be changed');
  const cat = record.getString('catalog_category');
  if (cat && $app.findRecordById('catalog_categories',cat).getString('merchant') !== record.getString('merchant')) throw new BadRequestError('Category belongs to another merchant');
  if (record.getBool('track_stock') && ['product','addon'].indexOf(record.getString('item_type')) < 0) throw new BadRequestError('Stock tracking is only available for physical products');
  e.next();
},'merchant_services');
