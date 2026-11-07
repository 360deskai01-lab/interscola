import type {
  OfficialExamRadarData,
  OfficialExamScheduleSummary,
} from '@/types/exam-radar';

export type ProjectedExamTrack = 'SAT' | 'IELTS';

/** Digital SAT resmi oturum döngüsü (kuzey yarımküre — Mart→Aralık). */
const SAT_CYCLE_MONTHS = [3, 5, 6, 8, 10, 11, 12] as const;

const IELTS_SESSION_OFFSET_DAYS = 38;

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!match) return null;
  const y = Number.parseInt(match[1]!, 10);
  const m = Number.parseInt(match[2]!, 10);
  const d = Number.parseInt(match[3]!, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return { y, m, d };
}

function formatYmdUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayUtcDateString(): string {
  return formatYmdUtc(new Date());
}

function calendarDaysUntil(examDateIso: string, referenceYmd?: string): number {
  const examParts = parseYmd(examDateIso);
  const refParts = parseYmd(referenceYmd ?? todayUtcDateString());
  if (!examParts || !refParts) return 0;
  const exam = Date.UTC(examParts.y, examParts.m - 1, examParts.d);
  const ref = Date.UTC(refParts.y, refParts.m - 1, refParts.d);
  const diffMs = exam - ref;
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function addCalendarDays(ymd: string, days: number): string {
  const parts = parseYmd(ymd);
  if (!parts) return ymd;
  const base = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  base.setUTCDate(base.getUTCDate() + days);
  return formatYmdUtc(base);
}

/**
 * Referans tarihinden sonraki ilk resmi SAT oturumu (yıllık döngü).
 * Gün: her döngü ayının ilk Cumartesi'sine yakın (ayın 2'si sabit çapa).
 */
export function projectNextSatExamDate(referenceYmd?: string): string {
  const ref = referenceYmd ?? todayUtcDateString();
  const refParts = parseYmd(ref);
  if (!refParts) return ref;

  for (let year = refParts.y; year <= refParts.y + 2; year += 1) {
    for (const cycleMonth of SAT_CYCLE_MONTHS) {
      if (year === refParts.y && cycleMonth < refParts.m) continue;
      const candidate = `${year}-${String(cycleMonth).padStart(2, '0')}-02`;
      if (candidate > ref) return candidate;
    }
  }

  return `${refParts.y + 1}-03-02`;
}

/** Aylık IELTS oturumu — referanstan ~38 gün sonrası. */
export function projectNextIeltsExamDate(referenceYmd?: string): string {
  const ref = referenceYmd ?? todayUtcDateString();
  return addCalendarDays(ref, IELTS_SESSION_OFFSET_DAYS);
}

export function projectFallbackUpcomingExam(
  track: ProjectedExamTrack,
  referenceYmd?: string,
): OfficialExamScheduleSummary {
  const ref = referenceYmd ?? todayUtcDateString();
  const examDate =
    track === 'SAT'
      ? projectNextSatExamDate(ref)
      : projectNextIeltsExamDate(ref);

  const [y, m] = examDate.split('-');
  const monthLabel = new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${examDate}T12:00:00.000Z`));

  const examName =
    track === 'SAT'
      ? `Digital SAT — ${monthLabel} (projeksiyon)`
      : `IELTS Academic — ${monthLabel} (projeksiyon)`;

  const closeDate = addCalendarDays(examDate, -14);

  return {
    id: `fallback-${track.toLowerCase()}-${examDate}`,
    examName,
    examType: track,
    examDate,
    registrationOpenDate: addCalendarDays(ref, 1),
    registrationCloseDate: closeDate > ref ? closeDate : ref,
    daysRemaining: calendarDaysUntil(examDate, ref),
    isProjected: true,
  };
}

function scheduleMatchesTrack(
  exam: OfficialExamScheduleSummary,
  track: ProjectedExamTrack,
): boolean {
  const blob = `${exam.examType ?? ''} ${exam.examName}`.toUpperCase();
  if (track === 'SAT') return blob.includes('SAT');
  return blob.includes('IELTS');
}

/**
 * Pist başına sınav tarihi: DB kaydı türle eşleşiyorsa onu kullan, yoksa deterministik projeksiyon.
 */
export function resolveTrackExamDateYmd(
  track: ProjectedExamTrack,
  nearestFromDb: OfficialExamScheduleSummary | null,
  referenceYmd?: string,
): string {
  if (nearestFromDb && scheduleMatchesTrack(nearestFromDb, track)) {
    return nearestFromDb.examDate.slice(0, 10);
  }
  return projectFallbackUpcomingExam(track, referenceYmd).examDate;
}

export interface EnrichExamRadarOptions {
  /** DB boşken radar kartında hangi pist projeksiyonu gösterilsin. */
  preferTrack?: ProjectedExamTrack;
  referenceDate?: string;
}

/**
 * `official_exam_schedules` boş veya eşleşmeyen kayıt olduğunda kokpit/radar için projeksiyon üretir.
 */
export function enrichOfficialExamRadar(
  data: OfficialExamRadarData,
  options?: EnrichExamRadarOptions,
): OfficialExamRadarData {
  if (data.nearestExam?.examDate) {
    return data;
  }

  const track = options?.preferTrack ?? 'SAT';
  const projected = projectFallbackUpcomingExam(track, options?.referenceDate);

  return {
    ...data,
    nearestExam: projected,
  };
}
