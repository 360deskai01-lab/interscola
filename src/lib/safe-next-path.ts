/**
 * Login `next` parametresi için açık yönlendirme koruması (yalnızca aynı-origin path).
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  if (value.includes('://')) {
    return null;
  }
  return value;
}

export const STUDENT_DIAGNOSTIC_EXPLORE_PATH =
  '/student/dashboard?tab=explore';

export const STUDENT_CAIE_EXPLORE_PATH = STUDENT_DIAGNOSTIC_EXPLORE_PATH;

export function loginUrlWithNext(nextPath: string): string {
  const safe = safeNextPath(nextPath) ?? '/student/dashboard';
  return `/auth/login?next=${encodeURIComponent(safe)}`;
}

export function registerUrlWithNext(nextPath: string): string {
  const safe = safeNextPath(nextPath) ?? '/student/dashboard';
  return `/auth/register?next=${encodeURIComponent(safe)}`;
}

export function registerUrlForDiagnostic(curriculum: string): string {
  const code = curriculum.trim().toUpperCase();
  return `/auth/register?source=diagnostic&curriculum=${encodeURIComponent(code)}`;
}
