import {
  computeSeatUsage,
  normalizeStudentQuota,
} from '@/lib/b2b/license-quota';

export const TEACHER_QUOTA_FALLBACK_MIN = 10;
export const TEACHER_QUOTA_STUDENT_RATIO = 10;

export function normalizeTeacherQuota(
  raw: number | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.floor(raw));
}

/**
 * `organizations.teacher_quota` yok/null ise öğrenci kotasının 1/10'u;
 * öğrenci kotası da yoksa güvenli taban (10).
 */
export function resolveTeacherQuota(
  teacherQuotaRaw: number | null | undefined,
  studentQuotaRaw: number | null | undefined,
): number {
  const explicit = normalizeTeacherQuota(teacherQuotaRaw);
  if (explicit !== null && explicit > 0) return explicit;

  const studentQuota = normalizeStudentQuota(studentQuotaRaw);
  if (studentQuota !== null && studentQuota > 0) {
    return Math.max(
      TEACHER_QUOTA_FALLBACK_MIN,
      Math.ceil(studentQuota / TEACHER_QUOTA_STUDENT_RATIO),
    );
  }

  return TEACHER_QUOTA_FALLBACK_MIN;
}

export function computeTeacherSeatUsage(
  teachersUsed: number,
  teacherQuota: number,
): {
  teachersUsed: number;
  teacherQuota: number;
  teachersRemaining: number;
  usagePercent: number;
  isTeacherQuotaFull: boolean;
} {
  const used = Math.max(0, Math.floor(teachersUsed));
  const quota = Math.max(1, Math.floor(teacherQuota));
  const isTeacherQuotaFull = used >= quota;
  const teachersRemaining = Math.max(0, quota - used);
  const usagePercent = Math.min(100, Math.round((used / quota) * 100));
  return {
    teachersUsed: used,
    teacherQuota: quota,
    teachersRemaining,
    usagePercent,
    isTeacherQuotaFull,
  };
}

/** Öğrenci kotası ile simetrik snapshot (öğretmen tarafı). */
export function computeTeacherLicenseSnapshot(
  teachersUsed: number,
  teacherQuotaRaw: number | null | undefined,
  studentQuotaRaw: number | null | undefined,
) {
  const resolvedQuota = resolveTeacherQuota(teacherQuotaRaw, studentQuotaRaw);
  return computeTeacherSeatUsage(teachersUsed, resolvedQuota);
}

/** Dashboard / audit sözleşmesi — doluluk bayrakları. */
export function buildTeacherQuotaSnapshot(
  teachersUsed: number,
  teacherQuotaRaw: number | null | undefined,
  studentQuotaRaw: number | null | undefined,
) {
  const base = computeTeacherLicenseSnapshot(
    teachersUsed,
    teacherQuotaRaw,
    studentQuotaRaw,
  );
  return {
    ...base,
    isFull: base.isTeacherQuotaFull,
    isOverQuota: base.teachersUsed > base.teacherQuota,
  };
}
