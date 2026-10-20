/**
 * Warms the data cache with everything the tab bar needs, so the splash can hold
 * until the tabs are ready and each tab's first render comes from memory.
 *
 * Every request goes through `cachedFetch`, so a screen mounting at the same moment
 * joins the in-flight run instead of issuing a duplicate.
 */
import type { AuthUser } from '@/context/AuthContext';
import { cachedFetch } from './data-cache';
import {
  cacheKeys,
  MERCHANT_FIELDS,
  PROGRAM_FIELDS,
  LOCATION_FIELDS,
  SUBSCRIPTION_FIELDS,
  TTL,
} from './cache-keys';
import { pb } from './pocketbase';

let startedKey = '';
let current: Promise<void> | null = null;

/** Clears the memoised run so the next login prefetches again (call from logout). */
export function resetPrefetch(): void {
  startedKey = '';
  current = null;
}

export function prefetchForRole(role: string | null | undefined, user: AuthUser | null): Promise<void> {
  if (!user) return Promise.resolve();

  const key = `${role}:${user.id}:${user.merchant_id || ''}`;
  if (startedKey === key && current) return current;

  startedKey = key;
  current = role === 'merchant' ? prefetchMerchant(user) : prefetchCustomer(user);
  return current;
}

function prefetchCustomer(user: AuthUser): Promise<void> {
  const uid = user.id;
  const phone = user.phone || '';

  const jobs: Promise<unknown>[] = [
    cachedFetch(
      cacheKeys.merchantsActive(),
      () =>
        pb.collection('merchants').getFullList({
          filter: `status = 'active'`,
          fields: MERCHANT_FIELDS,
          requestKey: null,
        }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.programsActive(),
      () =>
        pb.collection('loyalty_programs').getFullList({
          filter: 'is_active = true',
          fields: PROGRAM_FIELDS,
          requestKey: null,
        }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.locationsAll(),
      () => pb.collection('store_locations').getFullList({ fields: LOCATION_FIELDS, requestKey: null }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.subsActive(),
      () =>
        pb.collection('subscriptions').getFullList({
          filter: 'status = "active"',
          fields: SUBSCRIPTION_FIELDS,
          requestKey: null,
        }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.servicesAll(),
      () => pb.collection('merchant_services').getFullList({ requestKey: null }),
      { ttl: TTL.catalog }
    ),
    // Popularity signal for the home ranking. Ids only — a few bytes per row.
    cachedFetch(
      cacheKeys.activityCards(),
      () => pb.collection('loyalty_cards').getFullList({ fields: 'merchant', requestKey: null }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.activityBookings(),
      () => pb.collection('service_bookings').getFullList({ fields: 'merchant', requestKey: null }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.cardsMe(uid),
      () =>
        pb.collection('loyalty_cards').getFullList({
          filter: `customer = '${uid}' && status = 'active'`,
          expand: 'program,merchant',
          sort: '-updated',
          requestKey: null,
        }),
      { ttl: TTL.own }
    ),
    cachedFetch(
      cacheKeys.cardsAllMe(uid),
      () =>
        pb.collection('loyalty_cards').getFullList({
          filter: `customer = '${uid}'`,
          fields: 'id,opt_in_marketing,status',
          requestKey: null,
        }),
      { ttl: TTL.own }
    ),
    cachedFetch(
      cacheKeys.vouchersMe(uid),
      () =>
        pb.collection('vouchers').getFullList({
          filter: `customer = '${uid}'`,
          expand: 'reward,reward.merchant,campaign,campaign.merchant',
          sort: '-created',
          requestKey: null,
        }),
      { ttl: TTL.own }
    ),
    cachedFetch(
      cacheKeys.activeBooking(phone),
      () => pb.send(`/api/risev/customer/active-booking?phone=${encodeURIComponent(phone)}`, { method: 'GET', requestKey: null }),
      { ttl: TTL.live }
    ),
  ];

  return Promise.allSettled(jobs).then(() => undefined);
}

function prefetchMerchant(user: AuthUser): Promise<void> {
  const mid = user.merchant_id || '';
  if (!mid) return Promise.resolve();

  const jobs: Promise<unknown>[] = [
    cachedFetch(cacheKeys.merchant(mid), () => pb.collection('merchants').getOne(mid), { ttl: TTL.catalog }),
    cachedFetch(
      cacheKeys.merchantProgram(mid),
      () => pb.collection('loyalty_programs').getFirstListItem(`merchant = '${mid}' && is_active = true`),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.merchantSub(mid),
      () =>
        pb
          .collection('subscriptions')
          .getList(1, 1, {
            filter: `merchant = '${mid}' && (status = 'active' || status = 'trialing')`,
            sort: '-created',
            requestKey: null,
          })
          .then((r) => r.items[0] || null),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.merchantQuota(mid),
      () => pb.send('/api/risev/merchant/quota/packages', { method: 'GET' }),
      { ttl: TTL.own }
    ),
    cachedFetch(
      cacheKeys.merchantTxns(mid),
      () =>
        pb
          .collection('transactions')
          .getList(1, 1000, {
            filter: `merchant = '${mid}'`,
            expand: 'customer',
            sort: '-created',
            requestKey: null,
          })
          .then((r) => r.items),
      { ttl: TTL.own }
    ),
    cachedFetch(
      cacheKeys.merchantCards(mid),
      () =>
        pb.collection('loyalty_cards').getFullList({
          filter: `merchant = '${mid}'`,
          expand: 'customer',
          requestKey: null,
        }),
      { ttl: TTL.own }
    ),
    cachedFetch(
      cacheKeys.merchantCodes(mid),
      () =>
        pb.collection('activation_codes').getFullList({
          filter: `redeemed_by = '${mid}' && is_redeemed = true`,
          requestKey: null,
        }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.merchantBranches(mid),
      () =>
        pb.collection('branches').getFullList({
          filter: `merchant = '${mid}'`,
          sort: '-is_hq,-created',
          requestKey: null,
        }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.merchantStaff(mid),
      () =>
        pb.collection('merchant_staff').getFullList({
          filter: `merchant = '${mid}' && is_active = true`,
          requestKey: null,
        }),
      { ttl: TTL.catalog }
    ),
    cachedFetch(
      cacheKeys.pendingClaims(mid),
      () =>
        pb.collection('nfc_claims').getFullList({
          filter: `merchant = '${mid}' && status = 'pending'`,
          sort: '-created',
          requestKey: null,
        }),
      { ttl: TTL.live }
    ),
    cachedFetch(
      cacheKeys.campaigns(mid),
      () => pb.collection('campaigns').getFullList({ filter: `merchant = '${mid}'`, requestKey: null }),
      { ttl: TTL.own }
    ),
    cachedFetch(
      cacheKeys.broadcasts(mid),
      () =>
        pb.collection('broadcasts').getFullList({
          filter: `merchant = '${mid}'`,
          expand: 'campaign',
          requestKey: null,
        }),
      { ttl: TTL.own }
    ),
    cachedFetch(
      cacheKeys.automationRules(mid),
      () => pb.collection('automation_rules').getFullList({ filter: `merchant = '${mid}'`, requestKey: null }),
      { ttl: TTL.own }
    ),
    cachedFetch(cacheKeys.pricingSettings(), () => pb.collection('pricing_settings').getOne('pricesettings01'), {
      ttl: TTL.settings,
    }),
    cachedFetch(
      cacheKeys.promosActive(),
      () =>
        pb.collection('subscription_promo_codes').getFullList({
          filter: 'is_active = true',
          sort: '-created',
          requestKey: null,
        }),
      { ttl: TTL.settings }
    ),
  ];

  return Promise.allSettled(jobs).then(() => undefined);
}
