/** Öğrenci başına eşzamanlı aktif veli/gözlemci bağlantısı üst sınırı. */
export const OBSERVER_MAX_ACTIVE_TOKENS = 5;

export const MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI =
  'MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI' as const;

export const OBSERVER_MAX_ACTIVE_TOKEN_USER_MESSAGE =
  'En fazla 5 aktif veli bağlantısı oluşturabilirsiniz. Lütfen eskilerden birini iptal edin.';

export interface ObserverTokenActiveFields {
  isActive: boolean;
  expiresAt: string;
}

export function isStudentObserverTokenActive(
  row: ObserverTokenActiveFields,
  now: Date = new Date(),
): boolean {
  if (!row.isActive) return false;
  const exp = new Date(row.expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > now.getTime();
}

export function countActiveStudentObserverTokens(
  rows: ObserverTokenActiveFields[],
  now?: Date,
): number {
  return rows.filter((row) => isStudentObserverTokenActive(row, now)).length;
}

/** Yeni token üretimi reddedilmeli mi (aktif sayı >= üst sınır). */
export function shouldRejectObserverTokenCreation(activeCount: number): boolean {
  return activeCount >= OBSERVER_MAX_ACTIVE_TOKENS;
}
