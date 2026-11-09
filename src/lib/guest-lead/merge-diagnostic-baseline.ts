import { parseTargetNumber } from '@/lib/student-command-center/score-gap';
import type { GuestDiagnosticClaimPayload } from '@/lib/test-et/guest-diagnostic-claim';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function baselineValueFromClaim(
  payload: GuestDiagnosticClaimPayload,
): number {
  if (payload.curriculum === 'SAT') {
    return payload.rawScore;
  }
  if (payload.curriculum === 'IELTS') {
    return payload.rawScore;
  }
  return payload.percentage;
}

/**
 * `profiles.target_scores` içinde boş baseline alanlarını misafir teşhis ile doldurur.
 */
export function mergeGuestDiagnosticIntoTargetScores(
  existingTargetScores: unknown,
  payload: GuestDiagnosticClaimPayload,
): Record<string, unknown> {
  const base = isRecord(existingTargetScores)
    ? { ...existingTargetScores }
    : {};

  const baselineKey = `${payload.curriculum}_baseline`;
  const existingBaseline = base[baselineKey];
  if (
    parseTargetNumber(
      typeof existingBaseline === 'string' || typeof existingBaseline === 'number'
        ? existingBaseline
        : undefined,
    ) === null
  ) {
    base[baselineKey] = baselineValueFromClaim(payload);
  }

  base._guestDiagnosticClaim = {
    claimedAt: new Date().toISOString(),
    curriculum: payload.curriculum,
    scaledResult: payload.scaledResult,
    percentage: payload.percentage,
    completedAt: payload.completedAt,
    slug: payload.slug,
    is_timed_out: payload.is_timed_out ?? false,
  };

  return base;
}
