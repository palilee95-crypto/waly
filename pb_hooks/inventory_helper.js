// Shared by authenticated adjustment and sale completion. All mutations use a transaction app.
module.exports = {
  authorize: function(app, auth, merchantId, branchId) {
    if (!auth) throw new Error('Authentication required');
    const merchant = app.findRecordById('merchants', merchantId);
    const owner = merchant.getString('owner') === auth.id;
    if (!owner && auth.getString('merchant_id') !== merchantId) throw new Error('Merchant access denied');
    const assigned = auth.getString('branch');
    if (!owner && assigned && assigned !== branchId) throw new Error('Branch access denied');
    if (branchId && app.findRecordById('branches', branchId).getString('merchant') !== merchantId) throw new Error('Branch access denied');
  },
  adjust: function(app, auth, merchantId, branchId, itemId, quantity, reason, reference) {
    if (!Number.isFinite(quantity) || quantity === 0) throw new Error('Quantity must be a finite nonzero number');
    if (!reason || reason.length > 500 || !reference || reference.length > 200) throw new Error('Reason and unique reference are required');
    const item = app.findRecordById('merchant_services', itemId);
    if (item.getString('merchant') !== merchantId) throw new Error('Item access denied');
    if (item.getString('branch') && item.getString('branch') !== branchId) throw new Error('Item belongs to another branch');
    if (!item.getBool('track_stock')) throw new Error('Stock tracking is disabled for this item');
    if (['product','addon'].indexOf(item.getString('item_type')) < 0) throw new Error('Only physical products and add-ons can track stock');
    const previous = app.findRecordsByFilter('inventory_movements','merchant = {:merchant} && reference = {:reference}','',1,0,{merchant:merchantId,reference:reference});
    if (previous.length) {
      const p = previous[0];
      if (p.getString('item') !== itemId || p.getString('branch') !== branchId || p.getFloat('quantity') !== quantity || p.getString('reason') !== reason) throw new Error('Idempotency key was already used for a different adjustment');
      return {movement_id:p.id,quantity:p.getFloat('balance_after'),replayed:true};
    }
    const balances = app.findRecordsByFilter('inventory_balances','item = {:item} && branch = {:branch}','',1,0,{item:itemId,branch:branchId});
    const balance = balances.length ? balances[0] : new Record(app.findCollectionByNameOrId('inventory_balances'));
    const next = Math.round(((balances.length ? balance.getFloat('quantity') : 0) + quantity) * 1000000) / 1000000;
    if (next < 0) throw new Error('Insufficient stock for ' + item.getString('name'));
    balance.set('merchant',merchantId); balance.set('branch',branchId); balance.set('item',itemId); balance.set('quantity',next); app.save(balance);
    const movement = new Record(app.findCollectionByNameOrId('inventory_movements'));
    movement.set('merchant',merchantId); movement.set('branch',branchId); movement.set('item',itemId); movement.set('quantity',quantity); movement.set('balance_after',next); movement.set('actor',auth.id); movement.set('reason',reason); movement.set('reference',reference); app.save(movement);
    return {movement_id:movement.id,quantity:next,replayed:false};
  }
};
