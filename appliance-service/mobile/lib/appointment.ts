export const appointmentSlots = [
  { value: '10AM-12PM', label: '10:00 AM - 12:00 PM', startMinute: 10 * 60 },
  { value: '12PM-2PM', label: '12:00 PM - 2:00 PM', startMinute: 12 * 60 },
  { value: '2PM-4PM', label: '2:00 PM - 4:00 PM', startMinute: 14 * 60 },
  { value: '4PM-6PM', label: '4:00 PM - 6:00 PM', startMinute: 16 * 60 },
  { value: '6PM-7PM', label: '6:00 PM - 7:00 PM', startMinute: 18 * 60 },
] as const;

/** Format a device-local date as the date-only value expected by the booking API. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Validate a manually entered local calendar date without accepting rollover dates. */
export function isValidDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const [year, month, day] = dateKey.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day)) === dateKey;
}

/** Return only appointment slots that have not started yet on the selected day. */
export function getAvailableAppointmentSlots(dateKey: string, now: Date) {
  const todayKey = toDateKey(now);
  if (dateKey !== todayKey) return appointmentSlots;

  const currentMinute = now.getHours() * 60 + now.getMinutes();
  return appointmentSlots.filter((slot) => slot.startMinute > currentMinute);
}

/** Exclude today from booking when its last appointment window has started. */
export function isBookableDateKey(dateKey: string, now: Date): boolean {
  const todayKey = toDateKey(now);
  return dateKey >= todayKey
    && (dateKey !== todayKey || getAvailableAppointmentSlots(dateKey, now).length > 0);
}
