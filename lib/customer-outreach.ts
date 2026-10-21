import type { ManageCustomerDetail, ManageCustomerRow, ManageVoucher } from './customer-management';

export function isUsableVoucher(voucher: ManageVoucher, now = new Date()): boolean {
  if (voucher.status !== 'active') return false;
  if (!voucher.expiresAt) return true;
  const expires = new Date(voucher.expiresAt);
  return !Number.isNaN(expires.getTime()) && expires.getTime() > now.getTime();
}

export function validVouchers(vouchers: ManageVoucher[], now = new Date()): ManageVoucher[] {
  return vouchers.filter((voucher) => isUsableVoucher(voucher, now));
}

export type CustomerSignal = { title: string; detail: string; icon: 'gift-outline' | 'ribbon-outline' | 'sunny-outline' | 'chatbubble-ellipses-outline' | 'heart-outline' };

export function customerSignal(row: Pick<ManageCustomerRow, 'activeVouchers' | 'stampGoal' | 'stamps' | 'daysIdle' | 'lastVisit' | 'optInMarketing'>): CustomerSignal {
  if (row.activeVouchers > 0) return { title: 'Voucher available', detail: row.optInMarketing ? 'Share their valid voucher' : 'View it on their profile', icon: 'gift-outline' };
  const remaining = row.stampGoal - row.stamps;
  if (row.stampGoal > 0 && remaining > 0 && remaining <= 2) {
    return { title: `${remaining} stamp${remaining === 1 ? '' : 's'} from a reward`, detail: row.optInMarketing ? 'A timely reward reminder' : 'See loyalty progress', icon: 'ribbon-outline' };
  }
  if (row.lastVisit && row.daysIdle === 0) return { title: 'Visited today', detail: 'Thank them for coming in', icon: 'sunny-outline' };
  if (row.daysIdle !== null && row.daysIdle >= 30) return { title: 'Due for a check-in', detail: `${row.daysIdle} days since their last visit`, icon: 'chatbubble-ellipses-outline' };
  if (row.daysIdle !== null && row.daysIdle > 0) return { title: `Visited ${row.daysIdle} day${row.daysIdle === 1 ? '' : 's'} ago`, detail: 'A good moment to stay in touch', icon: 'heart-outline' };
  return { title: 'No visit recorded yet', detail: 'Invite them to their first visit', icon: 'heart-outline' };
}

export function detailSignal(detail: ManageCustomerDetail): CustomerSignal {
  return customerSignal({
    activeVouchers: validVouchers(detail.vouchers).length,
    optInMarketing: detail.profile.optInMarketing,
    stampGoal: detail.loyalty.stampGoal,
    stamps: detail.loyalty.stamps,
    daysIdle: detail.metrics.daysIdle,
    lastVisit: detail.metrics.lastVisit,
  });
}
