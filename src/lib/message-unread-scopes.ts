/** Tüm ödev-dışı okunmamış mesajların toplamı (rozet özeti). */
export const UNREAD_GENERAL_AGGREGATE_KEY = 'general';

/** Partner ile ödev-dışı (assignment_id IS NULL) thread rozeti. */
export function unreadGeneralScopeKey(partnerId: string): string {
  return `${UNREAD_GENERAL_AGGREGATE_KEY}:${partnerId}`;
}
