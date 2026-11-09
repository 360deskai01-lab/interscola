import { GUEST_DIAGNOSTIC_RESULT_KEY } from '@/lib/guest-lead/constants';
import type { GuestDiagnosticClaimPayload } from '@/lib/test-et/guest-diagnostic-claim';

export { GUEST_DIAGNOSTIC_RESULT_KEY };

export function parseGuestDiagnosticClaimPayload(
  raw: string,
): GuestDiagnosticClaimPayload | null {
  try {
    const parsed = JSON.parse(raw) as GuestDiagnosticClaimPayload;
    if (!parsed?.curriculum || !parsed.examTitle) return null;
    if (!Number.isFinite(parsed.rawScore) || !Number.isFinite(parsed.maxScore)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readGuestDiagnosticClaimFromStorage(): GuestDiagnosticClaimPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(GUEST_DIAGNOSTIC_RESULT_KEY);
  if (!raw) return null;
  return parseGuestDiagnosticClaimPayload(raw);
}

export function writeGuestDiagnosticClaimToStorage(
  payload: GuestDiagnosticClaimPayload,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    GUEST_DIAGNOSTIC_RESULT_KEY,
    JSON.stringify(payload),
  );
}

export function clearGuestDiagnosticClaimFromStorage(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GUEST_DIAGNOSTIC_RESULT_KEY);
}
