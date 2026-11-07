import type { CoordinatorMemberSummary } from '@/lib/b2b/coordinator-types';

function csvEscape(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function formatCsvDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function sanitizeOrgSlug(orgName: string): string {
  const base = orgName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base.slice(0, 48) : 'kurum';
}

/** Kurum raporu anteti için deterministik mühür (tarayıcı SHA-256). */
export async function computeCoordinatorReportSeal(
  organizationId: string,
  issuedAtIso: string,
): Promise<string> {
  const day = issuedAtIso.slice(0, 10);
  const payload = `interscola:coordinator-report:v1:${organizationId}:${day}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(payload),
    );
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `ISL-${hex.slice(0, 14).toUpperCase()}`;
  }
  return `ISL-${organizationId.replace(/-/g, '').slice(0, 14).toUpperCase()}`;
}

export function buildStudentsCsvContent(
  students: CoordinatorMemberSummary[],
): string {
  const header = [
    'Ad Soyad',
    'E-posta',
    'Bağlı Şube',
    'Hedef Sınavlar',
    'Son Deneme Skoru',
    'Kayıt Tarihi',
  ];
  const lines = [
    header.map(csvEscape).join(','),
    ...students.map((s) =>
      [
        s.displayName,
        s.email ?? '',
        s.branchName ?? '',
        s.targetExamLabels.join('; '),
        s.lastAttemptDisplay ?? '',
        formatCsvDate(s.memberCreatedAt),
      ]
        .map((cell) => csvEscape(String(cell)))
        .join(','),
    ),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

/**
 * Filtrelenmiş öğrenci listesini UTF-8 BOM'lu CSV olarak indirir (Excel uyumlu).
 */
export function exportStudentsToCSV(
  students: CoordinatorMemberSummary[],
  orgName: string,
): void {
  if (typeof document === 'undefined') return;
  const content = buildStudentsCsvContent(students);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `interscola_${sanitizeOrgSlug(orgName)}_${date}.csv`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
