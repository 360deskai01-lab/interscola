import type { BookingSlot } from '@/components/assistant/types';

export const ADMIN_AVAILABLE_TIMES = [
  '10:00',
  '11:30',
  '14:00',
  '15:30',
  '17:00',
] as const;

export type AdminTimeSlot = (typeof ADMIN_AVAILABLE_TIMES)[number];

const TR_WEEKDAY = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Bugünden itibaren gelecek `count` iş günü (Cumartesi/Pazar hariç). */
export function getNextBusinessDays(count: number, from: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0);

  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) continue;
    days.push(new Date(cursor));
  }

  return days;
}

export function formatBusinessDayLabel(date: Date): string {
  return TR_WEEKDAY.format(date);
}

export function toDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildSlot(date: Date, time: AdminTimeSlot): BookingSlot {
  return {
    dateIso: toDateIso(date),
    dateLabel: formatBusinessDayLabel(date),
    time,
  };
}

export function generateMeetPlaceholder(bookingId: string): string {
  return `https://meet.google.com/interscola-${bookingId.slice(0, 8)}`;
}
