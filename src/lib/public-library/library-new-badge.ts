/** Açık havuz kartlarında "YENİ" rozeti eşiği (gün). */
export const LIBRARY_NEW_BADGE_DAYS = 7;

export function isLibraryRecentlyAdded(
  createdAtIso: string,
  windowDays: number = LIBRARY_NEW_BADGE_DAYS,
): boolean {
  const created = new Date(createdAtIso);
  if (Number.isNaN(created.getTime())) return false;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return Date.now() - created.getTime() <= windowMs;
}
