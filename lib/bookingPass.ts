export const PASS_PUBLIC_ORIGIN = 'https://risev.app';

export function passOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return PASS_PUBLIC_ORIGIN;
}

export function buildPassUrl(slug: string, bookingId: string, origin?: string): string {
  const base = (origin || passOrigin()).replace(/\/+$/, '');
  return `${base}/b/${encodeURIComponent(slug)}?pass=${encodeURIComponent(bookingId)}`;
}

export function parsePassScan(raw: string): { bookingId: string } | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const match = text.match(/[?&]pass=([a-z0-9]{15})/i);
  if (!match) return null;
  return { bookingId: match[1].toLowerCase() };
}

export function shortPassRef(bookingId: string): string {
  const id = String(bookingId || '');
  return id ? id.slice(-6).toUpperCase() : '';
}
