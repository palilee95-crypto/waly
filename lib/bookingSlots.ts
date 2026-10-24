// Customer booking slots, shared by the public booking page and the merchant
// reschedule sheet so both offer the same times.

export const ALL_TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM',
];

export function parseSlotToMinutes(slot: string): number {
  if (!slot || typeof slot !== 'string') return 0;
  const [timePart, modifier] = slot.split(' ');
  if (!timePart) return 0;
  let [hours, minutes] = timePart.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return (hours || 0) * 60 + (minutes || 0);
}

export function isSlotInPast(slot: string, selectedIsoDate: string): boolean {
  if (!slot) return false;
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  if (selectedIsoDate < todayIso) return true;
  if (selectedIsoDate > todayIso) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return parseSlotToMinutes(slot) <= currentMinutes;
}

export function getPeriodForSlot(slot: string): 'Morning' | 'Afternoon' | 'Evening' {
  const mins = parseSlotToMinutes(slot);
  if (mins < 12 * 60) return 'Morning';
  if (mins < 17 * 60) return 'Afternoon';
  return 'Evening';
}

// ── Opening hours ────────────────────────────────────────────────────────────
// Mirrors pb_hooks/booking_availability.js: the client must not offer a slot the
// server will reject. Two shapes are stored in store_locations.hours:
//   { "Monday": "08:00 - 22:00", ... }
//   { "mon": { open: "08:00", close: "22:00", closed: false }, ... }

export type DayHours = {
  /** The merchant never configured hours — never block anything. */
  unset: boolean;
  closed: boolean;
  openMinutes: number;
  closeMinutes: number;
};

/** "08:00", "8:00 AM", "22:00", "11.00" → minutes since midnight. -1 when unparseable. */
export function parseClockMinutes(value?: string | null): number {
  const text = String(value ?? '').trim();
  if (!text) return -1;
  const ampm = /^(\d{1,2})[.:](\d{2})\s*(AM|PM)$/i.exec(text);
  if (ampm) {
    let hours = parseInt(ampm[1], 10);
    const minutes = parseInt(ampm[2], 10);
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return -1;
    if (ampm[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (ampm[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const plain = /^(\d{1,2})[.:](\d{2})$/.exec(text);
  if (plain) {
    const hours = parseInt(plain[1], 10);
    const minutes = parseInt(plain[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return -1;
    return hours * 60 + minutes;
  }
  return -1;
}

export function hoursForDate(hours: unknown, dateIso: string): DayHours {
  const unset: DayHours = { unset: true, closed: false, openMinutes: 0, closeMinutes: 0 };
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return unset;

  const source = hours as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.length === 0) return unset;

  const lowered: Record<string, unknown> = {};
  let anyValue = false;
  for (const key of keys) {
    const value = source[key];
    lowered[key.trim().toLowerCase()] = value;
    if (value !== undefined && value !== null && String(value).trim() !== '') anyValue = true;
  }
  if (!anyValue) return unset;

  const date = new Date(`${String(dateIso || '').trim()}T00:00:00Z`);
  if (isNaN(date.getTime())) return unset;

  const fullNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const shortNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayIndex = date.getUTCDay();
  let raw = lowered[fullNames[dayIndex]];
  if (raw === undefined) raw = lowered[shortNames[dayIndex]];
  // A day missing from a configured week is a closed day.
  if (raw === undefined) return { unset: false, closed: true, openMinutes: 0, closeMinutes: 0 };

  let openText = '';
  let closeText = '';
  let explicitlyClosed = false;
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const entry = raw as { open?: string; close?: string; closed?: boolean };
    explicitlyClosed = entry.closed === true;
    openText = String(entry.open || '');
    closeText = String(entry.close || '');
  } else {
    const text = String(raw).trim();
    if (!text || /^(closed|tutup)$/i.test(text)) {
      explicitlyClosed = true;
    } else {
      const parts = text.split(/\s*(?:-|–|—|\bto\b)\s*/i);
      if (parts.length >= 2) {
        openText = parts[0];
        closeText = parts[1];
      }
    }
  }
  if (explicitlyClosed) return { unset: false, closed: true, openMinutes: 0, closeMinutes: 0 };

  const openMinutes = parseClockMinutes(openText);
  let closeMinutes = parseClockMinutes(closeText);
  // Malformed hours are closed: a typo must never open the shop.
  if (openMinutes < 0 || closeMinutes < 0) return { unset: false, closed: true, openMinutes: 0, closeMinutes: 0 };

  // Some merchants type "11.00-9.00" with no AM/PM. When both ends sit inside
  // 1–12 and the close reads earlier than the open, the close is the evening
  // (11:00–21:00). Explicit 24-hour values (22:00-02:00) skip this and fall
  // through to the overnight rule below.
  if (closeMinutes <= openMinutes && openMinutes <= 12 * 60 && closeMinutes <= 12 * 60) {
    closeMinutes += 12 * 60;
  }
  return {
    unset: false,
    closed: false,
    openMinutes,
    closeMinutes: closeMinutes <= openMinutes ? closeMinutes + 1440 : closeMinutes,
  };
}

/** Whether a service fits inside the day's window (overnight-aware). */
export function fitsOpeningHours(day: DayHours, startMinutes: number, durationMinutes: number): boolean {
  if (!day || day.unset) return true;
  if (day.closed) return false;
  let start = startMinutes;
  if (day.closeMinutes > 1440 && start < day.openMinutes) start += 1440;
  if (start < day.openMinutes) return false;
  return start + Math.max(0, durationMinutes) <= day.closeMinutes;
}

/** 600 → "10:00 AM" (12-hour label for banners). */
export function formatMinutesLabel(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const modifier = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12 < 10 ? '0' : ''}${hours12}:${minutes < 10 ? '0' : ''}${minutes} ${modifier}`;
}
