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

export type DailyStamps = { date: string; stamps: number };

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
  trend: { date: string; visits: number }[];
  topCustomers: {
    id: string;
    name: string;
    avatar: string;
    visits: number;
    lastVisit: string;
    spendCents: number;
  }[];
  inactive: { id: string; name: string; avatar: string; lastVisit: string; daysIdle: number | null }[];
  attention: AttentionItem[];
  loyalty: { nearReward: number; availableVouchers: number; daily: DailyStamps[] };
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

/** Dynamic periods — never the pack's fixed Oct/Sep 2026 demo dates. */
export function workspacePeriods(now = localNow()): WorkspacePeriod[] {
  const thisMonth = monthRange(now.year, now.month);
  const prev = now.month === 1 ? { y: now.year - 1, m: 12 } : { y: now.year, m: now.month - 1 };
  const lastMonth = monthRange(prev.y, prev.m);
  return [
    { id: 'this_month', label: 'This month', ...thisMonth },
    { id: 'last_month', label: 'Last month', ...lastMonth },
  ];
}

export type FetchWorkspaceParams = {
  branchId?: string;
  from: string;
  to: string;
  signal?: AbortSignal;
};

export async function fetchWorkspace({
  branchId = 'all',
  from,
  to,
  signal,
}: FetchWorkspaceParams): Promise<WorkspaceSnapshot> {
  const qs = new URLSearchParams({ branch: branchId || 'all', from, to }).toString();
  return pb.send<WorkspaceSnapshot>(`/api/risev/merchant/customer-workspace?${qs}`, {
    method: 'GET',
    requestKey: null,
    signal,
  });
}

export type AudienceCard = 'return' | 'rewards' | 'rebook' | 'birthday' | 'all';

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
};

export type AudiencePage = { card: AudienceCard; page: number; items: AudienceRow[] };

/** Paginated rows for an Actions card. Counts live in the snapshot, rows are on demand. */
export async function fetchAudience(params: {
  card: AudienceCard;
  branchId?: string;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}): Promise<AudiencePage> {
  const { card, branchId = 'all', page = 1, perPage = 20, signal } = params;
  const qs = new URLSearchParams({
    card,
    branch: branchId || 'all',
    page: String(page),
    perPage: String(perPage),
  }).toString();
  return pb.send<AudiencePage>(`/api/risev/merchant/customer-workspace/audience?${qs}`, {
    method: 'GET',
    requestKey: null,
    signal,
  });
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
  const t = new Date(iso);
  if (isNaN(t.getTime())) return iso;
  return t.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
}

/** 'YYYY-MM-DD' (store-local) -> short label, without timezone drift. */
export function formatDayLabel(dateStr: string): string {
  const t = new Date(`${dateStr}T00:00:00+08:00`);
  if (isNaN(t.getTime())) return dateStr;
  return t.toLocaleDateString('en-MY', { weekday: 'short' });
}
