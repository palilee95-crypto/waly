// Deprecated: Points are now shop-specific and handled on the loyalty_cards collection directly in points_multiplier.pb.js.
onRecordAfterCreateSuccess((e) => {
  return e.next();
}, 'transactions');
