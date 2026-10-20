import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AudienceCard, AudienceRow, fetchAudience } from './customer-workspace';

const MAX_ROWS = 2000;
const PAGE = 200;

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).replace(/"/g, '""');
  return /[",\n]/.test(str) ? `"${str}"` : str;
}

/** Every customer in the given audience, pulled page by page up to a sane cap. */
export async function collectAudience(
  card: AudienceCard,
  branchId: string
): Promise<AudienceRow[]> {
  const all: AudienceRow[] = [];
  for (let page = 1; all.length < MAX_ROWS; page++) {
    const res = await fetchAudience({ card, branchId, page, perPage: PAGE });
    all.push(...res.items);
    if (res.items.length < PAGE) break;
  }
  return all.slice(0, MAX_ROWS);
}

export function buildAudienceCsv(rows: AudienceRow[], card: AudienceCard): string {
  const header =
    card === 'all'
      ? ['Name', 'Phone', 'Visits', 'Last Visit', 'Days Since Visit']
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
      card === 'all'
        ? [row.name, row.phone, row.visits ?? 0, row.lastVisit ?? '', row.daysOverdue ?? '']
        : [row.name, row.phone, row.daysOverdue ?? '', reason];
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
