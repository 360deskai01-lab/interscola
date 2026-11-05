import {
  buildAcademicTranscriptData,
  mergeTranscriptYears,
} from '@/lib/student-transcript/gpa-calculator';
import {
  createEmptyAcademicTranscript,
  GRADE_LEVELS,
  type AcademicTranscriptData,
  type GradeLevel,
  type SubjectRecord,
  type YearTranscript,
} from '@/lib/student-transcript/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseGradeLevel(raw: unknown): GradeLevel | null {
  const num =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (num === 10 || num === 11 || num === 12) return num;
  return null;
}

function parseSubject(raw: unknown): SubjectRecord | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const score100 =
    typeof raw.score100 === 'number'
      ? raw.score100
      : Number.parseFloat(String(raw.score100 ?? ''));
  const weeklyHours =
    typeof raw.weeklyHours === 'number'
      ? raw.weeklyHours
      : Number.parseFloat(String(raw.weeklyHours ?? ''));

  if (!id || !name) return null;
  if (!Number.isFinite(score100) || score100 < 0 || score100 > 100) {
    return null;
  }
  if (!Number.isFinite(weeklyHours) || weeklyHours <= 0 || weeklyHours > 40) {
    return null;
  }

  return { id, name, score100, weeklyHours };
}

function parseYear(raw: unknown, grade: GradeLevel): YearTranscript {
  const base: YearTranscript = { grade, subjects: [] };
  if (!isRecord(raw)) return base;

  const overall =
    raw.overallAverage === undefined || raw.overallAverage === null
      ? undefined
      : typeof raw.overallAverage === 'number'
        ? raw.overallAverage
        : Number.parseFloat(String(raw.overallAverage));

  if (
    overall !== undefined &&
    Number.isFinite(overall) &&
    overall >= 0 &&
    overall <= 100
  ) {
    base.overallAverage = overall;
  }

  if (Array.isArray(raw.subjects)) {
    base.subjects = raw.subjects
      .map(parseSubject)
      .filter((item): item is SubjectRecord => item !== null);
  }

  return base;
}

/** DB `profiles.academic_transcript` JSON → tip güvenli model. */
export function parseAcademicTranscript(raw: unknown): AcademicTranscriptData {
  if (!isRecord(raw) || Object.keys(raw).length === 0) {
    return createEmptyAcademicTranscript();
  }

  const yearsPartial: Partial<Record<GradeLevel, YearTranscript>> = {};

  if (isRecord(raw.years)) {
    for (const grade of GRADE_LEVELS) {
      const key = String(grade);
      if (raw.years[key] !== undefined) {
        yearsPartial[grade] = parseYear(raw.years[key], grade);
      }
    }
  }

  const years = mergeTranscriptYears(yearsPartial);

  return buildAcademicTranscriptData(
    years,
    typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  );
}

/** Kaydetmeden önce istemci yükünü doğrula ve yeniden hesapla. */
export function normalizeTranscriptInput(
  input: AcademicTranscriptData,
): { data?: AcademicTranscriptData; error?: string } {
  if (!input?.years) {
    return { error: 'Transkript verisi eksik.' };
  }

  const years = mergeTranscriptYears(input.years);

  for (const grade of GRADE_LEVELS) {
    const year = years[grade];
    if (year.overallAverage !== undefined) {
      const avg = year.overallAverage;
      if (!Number.isFinite(avg) || avg < 0 || avg > 100) {
        return {
          error: `${grade}. sınıf yıl sonu ortalaması 0–100 arasında olmalı.`,
        };
      }
    }

    for (const subject of year.subjects ?? []) {
      const parsed = parseSubject(subject);
      if (!parsed) {
        return {
          error: `${grade}. sınıfta geçersiz ders satırı: ad, not (0–100) ve haftalık saat (1–40) zorunlu.`,
        };
      }
    }
  }

  return { data: buildAcademicTranscriptData(years) };
}
