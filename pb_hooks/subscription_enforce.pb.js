// pb_hooks/subscription_enforce.pb.js
//
// Two things this file must not rely on:
//   1. `e.collection` is NOT populated for onRecordCreate handlers.
//   2. Only ONE onRecordCreate registration per file is honoured by this JSVM
//      (a second registration silently never fires).
//
// So: one tagged handler for all four collections, and the collection is read
// from `e.record.collection().name`. The body lives in the required module
// because handlers cannot see file-level declarations.

onRecordCreate((e) => {
  let collectionName = '';
  try {
    collectionName = e.record.collection().name;
  } catch (err) {}
  require(`${__hooks}/subscription_enforce_logic.js`).enforce(e, collectionName === 'loyalty_cards');
}, 'transactions', 'loyalty_programs', 'rewards', 'loyalty_cards');
