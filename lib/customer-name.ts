/**
 * Legacy NFC/quick-checkout claims appended the applied voucher to the customer
 * name (`Daadd [VOUCHER:id#title]`, sometimes `Daadd |VOUCHER:...`). It leaked
 * into the customer record, so every list and header showed it. The claim
 * already carries `voucher` + `voucher_title`; the tag is redundant.
 */
export function cleanCustomerName(raw?: string | null): string {
  const value = String(raw || '');
  if (!value) return '';
  return value
    .replace(/\s*\[\s*VOUCHER:[^\]]*\]\s*/gi, ' ')
    .replace(/\s*[|·]\s*VOUCHER:.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
