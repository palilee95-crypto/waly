import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  AudienceCard,
  AudienceRow,
  LedgerRow,
  LedgerType,
  fetchAudience,
  fetchTransactions,
  formatLocalDateFromIso,
  formatLocalTimeFromIso,
} from './customer-workspace';

const MAX_ROWS = 2000;
const PAGE = 50;

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).replace(/"/g, '""');
  return /[",\n]/.test(str) ? `"${str}"` : str;
}

/** Every customer in the given audience, pulled page by page up to a sane cap. */
export async function collectAudience(
  card: AudienceCard,
  branchId: string,
  from?: string,
  to?: string
): Promise<AudienceRow[]> {
  const all: AudienceRow[] = [];
  for (let page = 1; all.length < MAX_ROWS; page++) {
    const res = await fetchAudience({ card, branchId, from, to, page, perPage: PAGE });
    all.push(...res.items);
    if (res.items.length < PAGE) break;
  }
  return all.slice(0, MAX_ROWS);
}

export function buildAudienceCsv(rows: AudienceRow[], card: AudienceCard): string {
  const header = card === 'top'
    ? ['Name', 'Phone', 'Visits', 'Last Visit', 'Recorded Spend (RM)']
    : card === 'all'
      ? ['Name', 'Phone', 'Visits', 'Last Visit', 'Days Since Visit']
      : card === 'inactive'
        ? ['Name', 'Phone', 'Last Visit', 'Days Since Visit']
      : ['Name', 'Phone', 'Days Since Visit', 'Reason'];

  const lines = [header.join(',')];
  for (const row of rows) {
    const reason =
      card === 'rewards'
        ? row.reason === 'voucher'
          ? 'Has a valid voucher'
          : 'Near a reward'
        : card === 'birthday'
          ? `Birthday ${row.birthday ?? ''}`.trim()
          : '';
    const fields =
      card === 'top'
        ? [row.name, row.phone, row.visits ?? 0, row.lastVisit ?? '', ((row.spendCents ?? 0) / 100).toFixed(2)]
        : card === 'all'
        ? [row.name, row.phone, row.visits ?? 0, row.lastVisit ?? '', row.daysOverdue ?? '']
        : card === 'inactive'
          ? [row.name, row.phone, row.lastVisit ?? '', row.daysOverdue ?? '']
        : [row.name, row.phone, row.daysOverdue ?? '', reason];
    lines.push(fields.map(escapeField).join(','));
  }
  return lines.join('\n');
}

const LEDGER_MAX = 5000;

export async function collectLedger(params: {
  branchId: string;
  from: string;
  to: string;
  type?: LedgerType;
  q?: string;
  staffId?: string;
  unassignedOutlet?: boolean;
  unassignedStaff?: boolean;
  hour?: number;
  salesOnly?: boolean;
}): Promise<LedgerRow[]> {
  const all: LedgerRow[] = [];
  for (let page = 1; all.length < LEDGER_MAX; page++) {
    const res = await fetchTransactions({ ...params, page, perPage: 100 });
    all.push(...res.items);
    if (res.items.length < 100) break;
  }
  return all.slice(0, LEDGER_MAX);
}

export function buildLedgerCsv(rows: LedgerRow[]): string {
  const header = [
    'Date',
    'Time',
    'Customer',
    'Phone',
    'Type',
    'Outlet',
    'Staff',
    'Bill (RM)',
    'Stamps',
    'Points',
    'Voucher',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    const fields = [
      formatLocalDateFromIso(row.created),
      formatLocalTimeFromIso(row.created),
      row.customerName,
      row.customerPhone,
      row.type,
      row.branchName || 'HQ',
      row.staffName || 'Unassigned',
      (row.billCents / 100).toFixed(2),
      row.stamps,
      row.points,
      row.voucherCode,
    ];
    lines.push(fields.map(escapeField).join(','));
  }
  return lines.join('\n');
}

export async function shareCsv(fileName: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not supported on this device.');
  }
  const file = new File(Paths.cache, fileName);
  file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export customers',
    UTI: 'public.comma-separated-values-text',
  });
}
