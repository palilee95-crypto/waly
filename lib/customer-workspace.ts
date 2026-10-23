/**
 * Customer Workspace contract (merchant Customers tab).
 *
 * The snapshot is computed server-side by `pb_hooks/customer_workspace.pb.js` so the
 * metric definitions live in one place. Nothing here falls back to demo numbers:
 * a failed read surfaces an error the screen can retry.
 *
 * Definitions (do not drift):
 *   visited     distinct customers with a recorded transaction in scope + period
 *   new         first recorded visit inside the period
 *   returning   a recorded visit before the period  (new + returning = visited)
 *   AOV         eligible sales / eligible orders, never ÷ customers
 *   stamps      net stamp events, not visits and not customers
 *   missing     null, rendered as "No data" — never coerced to 0
 */
import { pb } from './pocketbase';

export type AttentionItem = {
  id: 'return' | 'rewards' | 'rebook';
  title: string;
  detail: string;
  count: number | null;
};

export type StampBucket = { date: string; label: string; detail: string; stamps: number };
export type ReviewRow = { id: string; name: string; stars: number; feedback: string; createdAt: string };
export type ReviewsPage = { page: number; perPage: number; total: number; items: ReviewRow[] };
export type ReviewFilter = number | 'low' | null;
export type ReviewSort = 'newest' | 'lowest';
export type ReviewSeriesPoint = { key: string; label: string; detail: string; count: number; avgRating: number | null };
export type ReviewImprovementStatus = 'open' | 'in_progress' | 'done';
export type ReviewImprovementCategory = 'service' | 'product' | 'wait' | 'staff' | 'other';
export type ReviewImprovementTask = {
  id: string;
  reviewId: string;
  title: string;
  category: ReviewImprovementCategory;
  status: ReviewImprovementStatus;
  ownerName: string;
  dueDate: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  review: Omit<ReviewRow, 'id'> | null;
};
export type ReviewImprovementList = { items: ReviewImprovementTask[]; counts: Record<ReviewImprovementStatus, number>; limit: number; truncated: boolean; allPeriods: boolean };

export type WorkspaceSnapshot = {
  asOf: string;
  timeZone: string;
  merchant: { id: string; name: string; logo: string };
  branches: { id: string; name: string; isHq: boolean }[];
  scope: { branchId: string; from: string; to: string };
  overview: {
    visited: number;
    newCount: number;
    returningCount: number;
    salesCents: number;
    stamps: number;
    pointsEarned: number;
    orders: number;
    avgOrderCents: number | null;
    vouchersRedeemed: number;
    previous: {
      from: string;
      visited: number;
      newCount: number;
      returningCount: number;
      salesCents: number;
    };
  };
  trend: { date: string; label?: string; visits: number }[];
  periodInsight?: {
    unit: 'hour' | 'day' | 'week' | 'month';
    label: string;
    visits: number;
    quieterCount: number;
  } | null;
  topCustomers: {
    id: string;
    name: string;
    avatar: string;
    phone?: string;
    visits: number;
    lastVisit: string;
    spendCents: number;
  }[];
  inactive: { id: string; name: string; avatar: string; lastVisit: string; daysIdle: number | null }[];
  attention: AttentionItem[];
  loyalty: {
    nearReward: number;
    /** Distinct customers holding at least one active, unexpired voucher. */
    availableVouchers: number;
    series: StampBucket[];
    granularity: 'hour' | 'day' | 'week' | 'month';
  };
  bookings: {
    completed: number;
    upcoming: number;
    cancelled: number;
    noShow: number;
    total: number;
    nextBookingCustomers: number;
  };
  birthdays: number;
  feedback: { responses: number; avgRating: number | null };
  unavailable: {
    googleReviewOpens: boolean;
    campaignResults: boolean;
    branchFeedback: boolean;
    availableSlots: boolean;
  };
  sales: {
    /** Day buckets, or month buckets when the period is longer than 92 days. */
    series: {
      date: string;
      salesCents: number;
      orders: number;
      buyers?: number;
      newCount: number;
      returningCount: number;
    }[];
    granularity: 'day' | 'month';
    /** Orders by local hour, index 0–23. */
    hours: number[];
    buyerCount: number | null;
    newSalesCents: number | null;
    returningSalesCents: number | null;
    unattributedSalesCents: number | null;
    outlets: { id: string; name: string; salesCents: number; orders: number }[];
    staff: { id: string; name: string; salesCents: number; orders: number; stamps: number }[];
  };
  customers: {
    frequency: { bucket: string; count: number }[];
    series: { date: string; newCount: number; returningCount: number }[];
  };
  bookingDetail: {
    revenueCents: number;
    completedValueCents: number | null;
    upcomingValueCents: number | null;
    nextUpcomingDate?: string | null;
    noShowRate: number | null;
    next7: { date: string; count: number; revenueCents: number }[];
    topServices: { name: string; count: number; revenueCents: number }[];
  };
  loyaltyDetail: {
    vouchersIssued: number;
    /** Vouchers used in the selected period, regardless of issue date. */
    vouchersUsed: number;
    /** Vouchers issued in the selected period and used by now. */
    issuedRedeemed: number | null;
    redemptionRate: number | null;
    pointsRedeemed: number;
    redemptions: number;
    activeCards: number;
  };
  reviews: {
    distribution: { stars: number; count: number }[];
    recent: ReviewRow[];
    series: ReviewSeriesPoint[];
    granularity: 'hour' | 'day' | 'week' | 'month';
  };
};

export type WorkspacePeriod = { id: string; label: string; from: string; to: string };

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Local (UTC+8) calendar parts — the app's stores run in Malaysia. */
function localNow() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
}

function monthRange(year: number, month: number) {
  const from = `${year}-${pad2(month)}-01`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return { from, to: `${next.y}-${pad2(next.m)}-01` };
}

/** Local (UTC+8) calendar date for an offset in days, as YYYY-MM-DD. */
function localDate(offsetDays: number): string {
  const t = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

function addDaysStr(date: string, days: number): string {
  const t = new Date(`${date}T00:00:00+08:00`);
  const u = new Date(t.getTime() + days * 86400000 + 8 * 3600 * 1000);
  return `${u.getUTCFullYear()}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())}`;
}

/** Dynamic periods — never the pack's fixed Oct/Sep 2026 demo dates. */
export function workspacePeriods(now = localNow()): WorkspacePeriod[] {
  const thisMonth = monthRange(now.year, now.month);
  const prev = now.month === 1 ? { y: now.year - 1, m: 12 } : { y: now.year, m: now.month - 1 };
  const lastMonth = monthRange(prev.y, prev.m);
  const today = localDate(0);
  const tomorrow = addDaysStr(today, 1);
  return [
    { id: 'today', label: 'Today', from: today, to: tomorrow },
    { id: 'last_7', label: 'Last 7 days', from: localDate(-6), to: tomorrow },
    { id: 'last_30', label: 'Last 30 days', from: localDate(-29), to: tomorrow },
    { id: 'this_month', label: 'This month', ...thisMonth },
    { id: 'last_month', label: 'Last month', ...lastMonth },
    { id: 'this_year', label: 'This year', from: `${now.year}-01-01`, to: `${now.year + 1}-01-01` },
  ];
}

export type LedgerType = 'all' | 'earn' | 'redeem' | 'expire' | 'adjust';

export type LedgerRow = {
  id: string;
  created: string;
  type: string;
  billCents: number;
  stamps: number;
  points: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  branchName: string;
  staffName: string;
  voucherCode: string;
  /** True when a paid digital receipt exists (a voucher can cover the whole bill). */
  hasReceipt?: boolean;
};

/** A ledger event can be a stamp or reward without a sale amount. */
export function formatLedgerImpact(row: LedgerRow): string {
  if (row.billCents > 0) return `RM ${(row.billCents / 100).toFixed(2)}`;
  if (row.stamps !== 0) return `${row.stamps > 0 ? '+' : ''}${row.stamps} stamp${Math.abs(row.stamps) === 1 ? '' : 's'}`;
  if (row.points !== 0) return `${row.points > 0 ? '+' : ''}${row.points} pts`;
  if (row.type === 'redeem') return 'Reward redeemed';
  if (row.type === 'expire') return 'Expired';
  if (row.type === 'adjust') return 'Adjustment';
  return 'Activity';
}

export type LedgerPage = { page: number; perPage: number; total: number; items: LedgerRow[] };

export type LedgerFocus = {
  from?: string;
  to?: string;
  branchId?: string;
  unassignedOutlet?: boolean;
  staffId?: string;
  unassignedStaff?: boolean;
  hour?: number;
  salesOnly?: boolean;
  title?: string;
};

/** The transaction ledger. Server-side so the filters and scope cannot drift. */
export async function fetchTransactions(params: {
  branchId: string;
  from: string;
  to: string;
  page?: number;
  perPage?: number;
  type?: LedgerType;
  q?: string;
  staffId?: string;
  unassignedOutlet?: boolean;
  unassignedStaff?: boolean;
  hour?: number;
  salesOnly?: boolean;
}): Promise<LedgerPage> {
  const { branchId, from, to, page = 1, perPage = 25, type = 'all', q = '' } = params;
  const qs = new URLSearchParams({
    branch: branchId || 'all',
    from,
    to,
    page: String(page),
    perPage: String(perPage),
    type,
  });
  if (q.trim()) qs.set('q', q.trim());
  if (params.staffId) qs.set('staff', params.staffId);
  if (params.unassignedOutlet) qs.set('unassignedOutlet', '1');
  if (params.unassignedStaff) qs.set('unassignedStaff', '1');
  if (params.hour !== undefined) qs.set('hour', String(params.hour));
  if (params.salesOnly) qs.set('salesOnly', '1');
  return pb.send<LedgerPage>(`/api/risev/merchant/customer-workspace/transactions?${qs.toString()}`, {
    method: 'GET',
    requestKey: null,
  });
}

/** Merchant-wide feedback; store_feedbacks has no branch field. */
export async function fetchReviews(params: {
  from: string;
  to: string;
  stars?: ReviewFilter;
  sort?: ReviewSort;
  commentsOnly?: boolean;
  page?: number;
  perPage?: number;
}): Promise<ReviewsPage> {
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
    page: String(params.page ?? 1),
    perPage: String(params.perPage ?? 20),
  });
  if (params.stars) qs.set('stars', String(params.stars));
  if (params.sort) qs.set('sort', params.sort);
  if (params.commentsOnly) qs.set('comments', '1');
  return pb.send<ReviewsPage>(`/api/risev/merchant/customer-workspace/reviews?${qs.toString()}`, {
    method: 'GET',
    requestKey: null,
  });
}

/** Improvement tasks are separate from immutable customer feedback. */
export async function fetchReviewImprovements(): Promise<ReviewImprovementList> {
  return pb.send<ReviewImprovementList>('/api/risev/merchant/review-improvements', { method: 'GET', requestKey: null });
}

export async function createReviewImprovement(input: {
  reviewId: string;
  title: string;
  category: ReviewImprovementCategory;
  ownerName: string;
  dueDate: string;
  note: string;
}): Promise<{ item: ReviewImprovementTask }> {
  return pb.send<{ item: ReviewImprovementTask }>('/api/risev/merchant/review-improvements', {
    method: 'POST', body: input, requestKey: null,
  });
}

export async function updateReviewImprovementStatus(id: string, status: ReviewImprovementStatus): Promise<{ item: ReviewImprovementTask }> {
  return pb.send<{ item: ReviewImprovementTask }>('/api/risev/merchant/review-improvements/status', {
    method: 'POST', body: { id, status }, requestKey: null,
  });
}

export type FetchWorkspaceParams = {
  branchId?: string;
  periodId?: string;
  from: string;
  to: string;
  signal?: AbortSignal;
};

/**
 * Fills in report blocks the server did not send.
 *
 * A running dev client can hold a snapshot fetched before the hooks were
 * redeployed, and a missing array used to crash the tab outright. Missing means
 * empty, never invented — the "No data" rules still apply on top.
 */
function normalizeSnapshot(raw: WorkspaceSnapshot): WorkspaceSnapshot {
  const emptyHours = () => new Array(24).fill(0) as number[];
  return {
    ...raw,
    loyalty: {
      nearReward: raw.loyalty?.nearReward ?? 0,
      availableVouchers: raw.loyalty?.availableVouchers ?? 0,
      series: raw.loyalty?.series ?? [],
      granularity: raw.loyalty?.granularity ?? 'day',
    },
    sales: {
      series: raw.sales?.series ?? [],
      granularity: raw.sales?.granularity ?? 'day',
      hours: raw.sales?.hours?.length === 24 ? raw.sales.hours : emptyHours(),
      buyerCount: raw.sales?.buyerCount ?? null,
      newSalesCents: raw.sales?.newSalesCents ?? null,
      returningSalesCents: raw.sales?.returningSalesCents ?? null,
      unattributedSalesCents: raw.sales?.unattributedSalesCents ?? null,
      outlets: raw.sales?.outlets ?? [],
      staff: raw.sales?.staff ?? [],
    },
    customers: {
      frequency: raw.customers?.frequency ?? [],
      series: raw.customers?.series ?? [],
    },
    bookingDetail: {
      revenueCents: raw.bookingDetail?.revenueCents ?? 0,
      completedValueCents: raw.bookingDetail?.completedValueCents ?? null,
      upcomingValueCents: raw.bookingDetail?.upcomingValueCents ?? null,
      nextUpcomingDate: raw.bookingDetail?.nextUpcomingDate,
      noShowRate: raw.bookingDetail?.noShowRate ?? null,
      next7: raw.bookingDetail?.next7 ?? [],
      topServices: raw.bookingDetail?.topServices ?? [],
    },
    loyaltyDetail: {
      vouchersIssued: raw.loyaltyDetail?.vouchersIssued ?? 0,
      vouchersUsed: raw.loyaltyDetail?.vouchersUsed ?? 0,
      issuedRedeemed: raw.loyaltyDetail?.issuedRedeemed ?? null,
      // Old server snapshots used a different denominator/numerator pairing.
      redemptionRate: raw.loyaltyDetail?.issuedRedeemed == null ? null : raw.loyaltyDetail?.redemptionRate ?? null,
      pointsRedeemed: raw.loyaltyDetail?.pointsRedeemed ?? 0,
      redemptions: raw.loyaltyDetail?.redemptions ?? 0,
      activeCards: raw.loyaltyDetail?.activeCards ?? 0,
    },
    reviews: {
      distribution: raw.reviews?.distribution ?? [],
      recent: (raw.reviews?.recent ?? []).map((row, index) => ({ ...row, id: row.id || `${row.createdAt}-${index}` })),
      series: raw.reviews?.series ?? [],
      granularity: raw.reviews?.granularity ?? 'day',
    },
  };
}

export async function fetchWorkspace({
  branchId = 'all',
  periodId = 'custom',
  from,
  to,
  signal,
}: FetchWorkspaceParams): Promise<WorkspaceSnapshot> {
  const qs = new URLSearchParams({ branch: branchId || 'all', period: periodId, from, to }).toString();
  const raw = await pb.send<WorkspaceSnapshot>(
    `/api/risev/merchant/customer-workspace?${qs}`,
    { method: 'GET', requestKey: null, signal }
  );
  return normalizeSnapshot(raw);
}

export type AudienceCard = 'return' | 'rewards' | 'rebook' | 'birthday' | 'all' | 'top' | 'inactive';

export type AudienceRow = {
  id: string;
  name: string;
  phone: string;
  /** return card */
  lastVisit?: string;
  daysOverdue?: number | null;
  /** rewards card */
  reason?: 'voucher' | 'near_reward';
  /** birthday card */
  birthday?: string | null;
  /** all-customers directory */
  visits?: number;
  spendCents?: number;
};

export type AudiencePage = {
  card: AudienceCard;
  page: number;
  items: AudienceRow[];
  /** Directory and report lists report a total; action cards take theirs from the snapshot. */
  total?: number;
};

/** Paginated rows for an Actions card. Counts live in the snapshot, rows are on demand. */
export async function fetchAudience(params: {
  card: AudienceCard;
  branchId?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}): Promise<AudiencePage> {
  const { card, branchId = 'all', from, to, page = 1, perPage = 20, signal } = params;
  const qs = new URLSearchParams({
    card,
    branch: branchId || 'all',
    page: String(page),
    perPage: String(perPage),
  }).toString();
  const scope = new URLSearchParams(qs);
  if (from) scope.set('from', from);
  if (to) scope.set('to', to);
  return pb.send<AudiencePage>(`/api/risev/merchant/customer-workspace/audience?${scope.toString()}`, {
    method: 'GET',
    requestKey: null,
    signal,
  });
}

export type CustomerActivity = {
  id: string;
  type: string;
  bill: number;
  stamps: number;
  points: number;
  created: string;
  method: string;
};

/** The card design the customer actually sees, straight from their loyalty program. */
export type CustomerCardDesign = {
  programName: string;
  cardColor: string;
  stampColor: string;
  fontColor: string;
  cardIcon: string;
  cardBackground: string;
  cardBackgroundBack: string;
  spendPerPoint: number;
  milestones: number[];
  enableStamps: boolean;
  enablePoints: boolean;
};

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string;
  stamps: number;
  goal: number;
  points: number;
  tier: string;
  completions: number;
  vouchers: number;
  lastActivity: string;
  activity: CustomerActivity[];
  card: CustomerCardDesign | null;
  merchantName: string;
  merchantLogo: string;
};

/**
 * One customer's standing at this merchant. `users` is not merchant-readable, so
 * name and phone come from the caller (the audience row, which reads the user
 * through the transaction relation) and everything else from the records the
 * merchant is allowed to see.
 */
export async function fetchCustomerDetail(
  customerId: string,
  fallback: { name?: string; phone?: string } = {}
): Promise<CustomerDetail> {
  const merchantId = String(pb.authStore.record?.merchant_id || '');
  const [cards, txns, vouchers, merchant] = await Promise.all([
    pb
      .collection('loyalty_cards')
      .getList(1, 1, {
        filter: `merchant="${merchantId}" && customer="${customerId}"`,
        expand: 'program',
        requestKey: null,
      })
      .catch(() => null),
    pb
      .collection('transactions')
      .getList(1, 12, {
        filter: `merchant="${merchantId}" && customer="${customerId}"`,
        sort: '-created',
        requestKey: null,
      })
      .catch(() => null),
    pb
      .collection('vouchers')
      .getList(1, 1, {
        filter: `customer="${customerId}" && reward.merchant="${merchantId}" && status="active"`,
        requestKey: null,
      })
      .catch(() => null),
    merchantId
      ? pb.collection('merchants').getOne(merchantId, { requestKey: null }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const card: any = cards?.items?.[0] || null;
  const rows: any[] = txns?.items || [];
  const expanded: any = rows.find((r) => r.expand?.customer)?.expand?.customer || null;
  const program: any = card?.expand?.program || null;
  const merchantRecord: any = merchant || null;

  // sub_rewards is a JSON field: an array when the SDK parsed it, a string when it did not.
  const subRewards = (() => {
    const raw = program?.sub_rewards;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();

  return {
    id: customerId,
    name: fallback.name || expanded?.name || 'Customer',
    phone: fallback.phone || expanded?.phone || '',
    stamps: Number(card?.stamps_collected) || 0,
    goal: Number(card?.expand?.program?.stamp_goal) || 10,
    points: Number(card?.points_balance) || 0,
    tier: String(card?.tier || 'bronze'),
    completions: Number(card?.completions) || 0,
    vouchers: vouchers?.totalItems ?? 0,
    lastActivity: rows[0]?.created || card?.last_activity || '',
    activity: rows.map((r) => ({
      id: r.id,
      type: String(r.type || ''),
      bill: Number(r.bill_amount) || 0,
      stamps: Number(r.stamps) || 0,
      points: Number(r.points) || 0,
      created: r.created,
      method: String(r.method || ''),
    })),
    card: program
      ? {
          programName: String(program.name || ''),
          cardColor: String(program.card_color || ''),
          stampColor: String(program.stamp_color || ''),
          fontColor: String(program.font_color || ''),
          cardIcon: String(program.card_icon || ''),
          cardBackground: program.card_background
            ? `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background}`
            : '',
          cardBackgroundBack: program.card_background_back
            ? `${pb.baseUrl}/api/files/loyalty_programs/${program.id}/${program.card_background_back}`
            : '',
          spendPerPoint: Number(program.spend_per_point) || 1,
          milestones: subRewards
            .map((entry: any) => Number(entry?.at_stamp))
            .filter((stamp: number) => Number.isFinite(stamp) && stamp > 0),
          enableStamps: program.enable_stamps !== false,
          enablePoints: program.enable_points === true,
        }
      : null,
    merchantName: String(merchantRecord?.name || ''),
    merchantLogo: merchantRecord?.logo
      ? `${pb.baseUrl}/api/files/merchants/${merchantRecord.id}/${merchantRecord.logo}`
      : '',
  };
}

/** null means the plan has no removal cap. */
export type DeletionAllowance = { used: number; max: number } | null;

export async function fetchDeletionAllowance(): Promise<DeletionAllowance> {
  const res = await pb.send<any>('/api/risev/merchant/quota/packages', {
    method: 'GET',
    requestKey: null,
  });
  const current = res?.current;
  if (!current || current.unlimited || typeof current.deletions_allowed !== 'number') return null;
  const merchantId = String(pb.authStore.record?.merchant_id || '');
  const merchant = await pb.collection('merchants').getOne(merchantId, { requestKey: null }).catch(() => null);
  let used = 0;
  try {
    const raw = merchant?.metadata;
    const meta = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
    used = parseInt(meta.stand_customer_deletions, 10) || 0;
  } catch {
    used = 0;
  }
  return { used, max: current.deletions_allowed };
}

/** Removes the customer from THIS merchant: cards, transactions and their vouchers. */
export async function deleteCustomer(customerId: string): Promise<{ remaining: number | null }> {
  const res = await pb.send<{ remaining_deletions?: number | null }>(
    '/api/risev/merchant/customer/delete',
    { method: 'POST', body: { customer_id: customerId }, requestKey: null }
  );
  return { remaining: typeof res?.remaining_deletions === 'number' ? res.remaining_deletions : null };
}

export function formatMoney(cents: number | null): string {
  if (cents === null || cents === undefined) return 'No data';
  return `RM ${(cents / 100).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCount(value: number | null): string {
  if (value === null || value === undefined) return 'No data';
  return value.toLocaleString('en-MY');
}

/** Percent change vs the previous period, or null when there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** '2026-07-21 16:04:02.998Z' -> '2 days ago' / 'today'. */
export function relativeDays(iso: string): string {
  if (!iso) return '';
  let v = String(iso).trim().replace(' ', 'T');
  if (!/Z$/i.test(v)) v += 'Z';
  const t = new Date(v).getTime();
  if (isNaN(t)) return '';
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function formatShortDateFromIso(iso: string): string {
  const t = new Date(String(iso || '').replace(' ', 'T'));
  if (isNaN(t.getTime())) return iso;
  return t.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
}

/** PocketBase stores UTC; the ledger must read in the device's local time. */
export function formatLocalTimeFromIso(iso: string): string {
  const t = new Date(String(iso || '').replace(' ', 'T'));
  if (isNaN(t.getTime())) return String(iso || '').slice(11, 16);
  return t.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Local calendar day, so a late-night sale is not exported as the previous day. */
export function formatLocalDateFromIso(iso: string): string {
  const t = new Date(String(iso || '').replace(' ', 'T'));
  if (isNaN(t.getTime())) return String(iso || '').slice(0, 10);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** 'YYYY-MM-DD' (store-local) -> short label, without timezone drift. */
export function formatDayLabel(dateStr: string): string {
  const t = new Date(`${dateStr}T00:00:00+08:00`);
  if (isNaN(t.getTime())) return dateStr;
  return t.toLocaleDateString('en-MY', { weekday: 'short' });
}
