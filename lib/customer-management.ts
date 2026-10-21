import { pb } from './pocketbase';

export function avatarUrl(customerId: string, avatar: string): string {
  if (!avatar) return '';
  return `${pb.baseUrl}/api/files/_pb_users_auth_/${customerId}/${encodeURIComponent(avatar)}`;
}

export type ManageCustomerRow = {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  visits: number;
  visitsOnDate: number;
  lastVisit: string | null;
  daysIdle: number | null;
  spendCents: number;
  stamps: number;
  stampGoal: number;
  points: number;
  activeVouchers: number;
  tier: string;
  optInMarketing: boolean;
  joinedAt: string;
};

export type ManageVoucher = {
  id: string;
  code: string;
  status: 'active' | 'used' | 'expired' | 'voided' | string;
  rewardName: string;
  expiresAt: string | null;
  createdAt: string;
};

export type ManageActivity = {
  id: string;
  type: string;
  billCents: number;
  stamps: number;
  points: number;
  createdAt: string;
  staffName: string;
  branchName: string;
};

export type ManageCustomerDetail = {
  profile: {
    id: string;
    name: string;
    phone: string;
    avatar: string;
    tier: string;
    joinedAt: string;
    birthday: string | null;
    optInMarketing: boolean;
  };
  metrics: {
    visits: number;
    spendCents: number;
    avgSpendCents: number | null;
    lastVisit: string | null;
    daysIdle: number | null;
  };
  loyalty: {
    cardId: string | null;
    programName: string;
    stamps: number;
    stampGoal: number;
    completions: number;
    points: number;
    enableStamps: boolean;
    enablePoints: boolean;
  };
  vouchers: ManageVoucher[];
  activity: ManageActivity[];
};

export type ManageCustomersPage = {
  items: ManageCustomerRow[];
  total: number;
  page: number;
  perPage: number;
  date?: string;
};

export type ManageSort = 'last_visit' | 'name' | 'visits' | 'spend';
export type ManageFilter = 'all' | 'at_risk' | 'near_reward' | 'new';

export type ManageReward = {
  id: string;
  name: string;
  title?: string;
  description?: string;
  is_active?: boolean;
};

export async function fetchManageCustomers(params: {
  branchId?: string;
  date?: string;
  q?: string;
  sort?: ManageSort;
  filter?: ManageFilter;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}): Promise<ManageCustomersPage> {
  const qs = new URLSearchParams({
    branch: params.branchId || 'all',
    sort: params.sort || 'last_visit',
    filter: params.filter || 'all',
    page: String(params.page || 1),
    perPage: String(params.perPage || 25),
  });
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.date) qs.set('date', params.date);
  const result = await pb.send<ManageCustomersPage>(
    `/api/risev/merchant/customer-workspace/customers?${qs.toString()}`,
    { method: 'GET', requestKey: null, signal: params.signal }
  );
  if (params.date && result.date !== params.date) {
    throw new Error('Date filtering is not available on this server yet. Deploy the latest backend, then retry.');
  }
  return result;
}

export async function fetchManageCustomer(
  customerId: string,
  branchId?: string,
  signal?: AbortSignal
): Promise<ManageCustomerDetail> {
  const qs = new URLSearchParams({
    customer: customerId,
    branch: branchId || 'all',
  });
  return pb.send<ManageCustomerDetail>(
    `/api/risev/merchant/customer-workspace/customer?${qs.toString()}`,
    { method: 'GET', requestKey: null, signal }
  );
}

export async function updateCustomerInfo(
  customerId: string,
  name: string,
  phone: string
): Promise<{ success: boolean; customer: { id: string; name: string; phone: string } }> {
  return pb.send('/api/risev/merchant/customer/update', {
    method: 'POST',
    body: { customer_id: customerId, name, phone },
    requestKey: null,
  });
}

export async function adjustCustomerStamps(
  customerId: string,
  delta: number,
  reason: string
): Promise<{
  success: boolean;
  stamps: number;
  goal: number;
  completions: number;
  rewardUnlocked: boolean;
}> {
  return pb.send('/api/risev/merchant/customer/stamps-adjust', {
    method: 'POST',
    body: { customer_id: customerId, delta, reason },
    requestKey: null,
  });
}

export async function adjustCustomerPoints(
  customerId: string,
  delta: number,
  reason: string
): Promise<{ success: boolean; points: number }> {
  return pb.send('/api/risev/merchant/customer/points-adjust', {
    method: 'POST',
    body: { customer_id: customerId, delta, reason },
    requestKey: null,
  });
}

export async function fetchCustomerVouchers(
  customerId: string,
  status?: string,
  signal?: AbortSignal
): Promise<{ items: ManageVoucher[] }> {
  const qs = new URLSearchParams({ customer: customerId });
  if (status) qs.set('status', status);
  return pb.send<{ items: ManageVoucher[] }>(
    `/api/risev/merchant/customer/vouchers?${qs.toString()}`,
    { method: 'GET', requestKey: null, signal }
  );
}

export async function issueCustomerVoucher(params: {
  customerId: string;
  rewardId: string;
  expiresAt?: string;
  note?: string;
}): Promise<{ success: boolean; voucher: ManageVoucher }> {
  return pb.send('/api/risev/merchant/customer/vouchers/issue', {
    method: 'POST',
    body: {
      customer_id: params.customerId,
      reward_id: params.rewardId,
      expires_at: params.expiresAt || undefined,
      note: params.note || '',
    },
    requestKey: null,
  });
}

export async function voidCustomerVoucher(
  voucherId: string,
  reason: string
): Promise<{ success: boolean; voucher: ManageVoucher }> {
  return pb.send('/api/risev/merchant/customer/vouchers/void', {
    method: 'POST',
    body: { voucher_id: voucherId, reason },
    requestKey: null,
  });
}

export async function fetchManageRewards(merchantId: string): Promise<ManageReward[]> {
  if (!merchantId) return [];
  return pb.collection('rewards').getFullList<ManageReward>({
    filter: `merchant = "${merchantId}" && is_active != false`,
    sort: 'name',
    requestKey: null,
  });
}
