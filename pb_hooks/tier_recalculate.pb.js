// Membership tiers were removed in favour of the flat, merchant-configured points
// rules (earn rate / redemption rate / minimum / limits on loyalty_programs).
//
// The previous body after this point was unreachable (`return e.next()` came first)
// and referenced undefined `customerId` / `cardId`, so it would have thrown a
// ReferenceError had it ever run. `loyalty_cards.tier` is not recalculated anywhere;
// UI reads fall back to 'bronze'. Kept as a no-op so the hook registration still
// exists if tiers return.
onRecordCreate((e) => {
  return e.next();
}, "transactions");
