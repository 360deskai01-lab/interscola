export const ORG_JOIN_QUOTA_FULL_MESSAGE =
  'Bu kurumun öğrenci lisans kotası dolmuştur. Lütfen okul koordinatörünüzle iletişime geçin.';

export const ORG_JOIN_LICENSE_INACTIVE_MESSAGE =
  'Geçersiz veya süresi dolmuş katılım kodu.';

/** Kurum lisansı aktif mi (`is_active` + `valid_until`). */
export function isOrganizationLicenseActive(
  isActive: boolean | null | undefined,
  validUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isActive) return false;
  if (!validUntil?.trim()) return true;
  const end = new Date(validUntil);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() >= now.getTime();
}

export function normalizeStudentQuota(
  raw: number | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (!Number.isFinite(raw)) return null;
  return Math.max(0, Math.floor(raw));
}

/** `seatsUsed >= student_quota` (quota null ise sınırsız). */
export function isStudentQuotaExceeded(
  seatsUsed: number,
  studentQuota: number | null,
): boolean {
  if (studentQuota === null) return false;
  return seatsUsed >= studentQuota;
}

export function computeSeatUsage(
  seatsUsed: number,
  studentQuota: number | null,
): {
  seatsUsed: number;
  studentQuota: number | null;
  seatsRemaining: number | null;
  usagePercent: number | null;
  isQuotaFull: boolean;
} {
  const used = Math.max(0, Math.floor(seatsUsed));
  const quota = normalizeStudentQuota(studentQuota);
  const isQuotaFull = isStudentQuotaExceeded(used, quota);
  const seatsRemaining =
    quota === null ? null : Math.max(0, quota - used);
  const usagePercent =
    quota === null || quota === 0
      ? null
      : Math.min(100, Math.round((used / quota) * 100));
  return {
    seatsUsed: used,
    studentQuota: quota,
    seatsRemaining,
    usagePercent,
    isQuotaFull,
  };
}
