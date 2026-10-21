// Normalise a manually-entered customer phone for POS/claim flows.
// Returns "" when the number cannot be turned into a valid Malaysian number, so
// callers can use it as a truthiness check before charging.

export function normalizeManualPosPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';

  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = '6' + normalized;
  }
  if (!normalized.startsWith('60')) {
    if (normalized.length < 9) return '';
    normalized = '60' + normalized;
  }

  // POS checkout requires a Malaysian mobile number: 601 followed by 8–9 digits.
  if (!/^601\d{8,9}$/.test(normalized)) return '';

  return '+' + normalized;
}
