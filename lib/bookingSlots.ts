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
