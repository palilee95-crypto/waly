/** Cache keys and shared field projections. Prefetcher and screens must agree on both. */

export const cacheKeys = {
  // ── Shared catalog (customer) ──
  merchantsActive: () => 'merchants:active',
  programsActive: () => 'programs:active',
  locationsAll: () => 'locations:all',
  subsActive: () => 'subs:active',
  servicesAll: () => 'services:all',
  activityCards: () => 'activity:cards',
  activityBookings: () => 'activity:bookings',

  // ── Per customer ──
  cardsMe: (userId: string) => `cards:me:${userId}`,
  cardsAllMe: (userId: string) => `cards:all:me:${userId}`,
  vouchersMe: (userId: string) => `vouchers:me:${userId}`,
  activeBooking: (phone: string) => `booking:active:${phone}`,

  // ── Per merchant ──
  merchant: (merchantId: string) => `merchant:${merchantId}`,
  merchantProgram: (merchantId: string) => `program:merchant:${merchantId}`,
  merchantSub: (merchantId: string) => `sub:merchant:${merchantId}`,
  merchantQuota: (merchantId: string) => `quota:${merchantId}`,
  merchantTxns: (merchantId: string) => `txns:merchant:${merchantId}`,
  merchantCards: (merchantId: string) => `cards:merchant:${merchantId}`,
  merchantCodes: (merchantId: string) => `codes:merchant:${merchantId}`,
  merchantBranches: (merchantId: string) => `branches:merchant:${merchantId}`,
  merchantStaff: (merchantId: string) => `staff:merchant:${merchantId}`,
  pendingClaims: (merchantId: string) => `claims:pending:${merchantId}`,
  campaigns: (merchantId: string) => `campaigns:${merchantId}`,
  broadcasts: (merchantId: string) => `broadcasts:${merchantId}`,
  automationRules: (merchantId: string) => `rules:${merchantId}`,

  // ── Global ──
  pricingSettings: () => 'pricing:settings',
  promosActive: () => 'promos:active',
};

export const TTL = {
  catalog: 60_000,
  own: 30_000,
  live: 15_000,
  settings: 300_000,
};

/** Superset of the fields Home and Explore read. Unknown names are tolerated by PocketBase. */
export const MERCHANT_FIELDS =
  'id,name,category,pwa_slug,metadata,banner,logo,subscription_plan,rating,review_count,reviews,pwa_brand_color';

export const PROGRAM_FIELDS = 'merchant,is_active,card_background';
export const LOCATION_FIELDS = 'merchant,name,city,address,lat,lng';
export const SUBSCRIPTION_FIELDS = 'merchant,plan,status';

/** Prefixes used with `invalidate()` after a write or a realtime event. */
export const CACHE_PREFIX = {
  cardsMe: 'cards:me',
  vouchersMe: 'vouchers:me',
  booking: 'booking:active',
  merchantCards: 'cards:merchant',
  merchantTxns: 'txns:merchant',
  pendingClaims: 'claims:pending',
};
