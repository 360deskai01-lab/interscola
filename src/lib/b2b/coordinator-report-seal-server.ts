import { createHash } from 'node:crypto';

/** Sunucu tarafı kurum karne doğrulama kodu (gün + kurum kimliği). */
export function computeCoordinatorReportSealServer(
  organizationId: string,
  issuedAtIso: string,
): string {
  const day = issuedAtIso.slice(0, 10);
  const payload = `interscola:institutional-report:v2:${organizationId}:${day}`;
  const hex = createHash('sha256').update(payload).digest('hex');
  return `ISL-${hex.slice(0, 14).toUpperCase()}`;
}
