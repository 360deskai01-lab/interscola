import {
  createEmptyTranscriptYears,
  GRADE_LEVELS,
  type AcademicTranscriptData,
  type GradeLevel,
  type SubjectRecord,
  type YearTranscript,
} from '@/lib/student-transcript/types';

const TWO_DECIMAL = (value: number): number =>
  Math.round(value * 100) / 100;

/** 100'lük not → WES/ABD 4.0 baremi (deterministik). */
export function score100ToGpaPoint(score100: number): number {
  if (!Number.isFinite(score100)) return 0;
  if (score100 >= 85) return 4;
  if (score100 >= 70) return 3;
  if (score100 >= 60) return 2;
  if (score100 >= 50) return 1;
  return 0;
}

/** Kümülatif 100'lük ortalamadan harf notu (WES tarzı). */
export function wesLetterFromCumulative100(cumulative100: number): string {
  if (!Number.isFinite(cumulative100) || cumulative100 <= 0) return '—';
  if (cumulative100 >= 90) return 'A';
  if (cumulative100 >= 85) return 'A-';
  if (cumulative100 >= 80) return 'B+';
  if (cumulative100 >= 70) return 'B';
  if (cumulative100 >= 60) return 'C';
  if (cumulative100 >= 50) return 'D';
  return 'F';
}

function weightedSubjectAverage(subjects: SubjectRecord[]): number | null {
  if (subjects.length === 0) return null;
  let weightedSum = 0;
  let totalHours = 0;
  for (const subject of subjects) {
    const hours = subject.weeklyHours;
    const score = subject.score100;
    if (!Number.isFinite(hours) || hours <= 0) continue;
    if (!Number.isFinite(score) || score < 0 || score > 100) continue;
    weightedSum += score * hours;
    totalHours += hours;
  }
  if (totalHours <= 0) return null;
  return weightedSum / totalHours;
}

/** Yıl sonu ortalaması: manuel alan yoksa ders saatlerine göre ağırlıklı ortalama. */
export function resolveYearAverage100(
  year: YearTranscript,
): number | null {
  const manual = year.overallAverage;
  if (
    manual !== undefined &&
    Number.isFinite(manual) &&
    manual >= 0 &&
    manual <= 100
  ) {
    return manual;
  }
  const subjects = year.subjects ?? [];
  return weightedSubjectAverage(subjects);
}

export function computeAcademicTranscriptMetrics(
  years: Record<GradeLevel, YearTranscript>,
): Pick<
  AcademicTranscriptData,
  'cumulative100' | 'gpa4Scale' | 'wesEquivalentGrade'
> {
  const yearAverages: number[] = [];

  for (const grade of GRADE_LEVELS) {
    const avg = resolveYearAverage100(years[grade]);
    if (avg !== null) yearAverages.push(avg);
  }

  if (yearAverages.length === 0) {
    return {
      cumulative100: 0,
      gpa4Scale: 0,
      wesEquivalentGrade: '—',
    };
  }

  const cumulative100 = TWO_DECIMAL(
    yearAverages.reduce((sum, value) => sum + value, 0) /
      yearAverages.length,
  );

  const gpaPoints = yearAverages.map((avg) => score100ToGpaPoint(avg));
  const gpa4Scale = TWO_DECIMAL(
    gpaPoints.reduce((sum, value) => sum + value, 0) / gpaPoints.length,
  );

  return {
    cumulative100,
    gpa4Scale,
    wesEquivalentGrade: wesLetterFromCumulative100(cumulative100),
  };
}

export function buildAcademicTranscriptData(
  years: Record<GradeLevel, YearTranscript>,
  updatedAt?: string,
): AcademicTranscriptData {
  const metrics = computeAcademicTranscriptMetrics(years);
  return {
    years,
    ...metrics,
    updatedAt,
  };
}

export function mergeTranscriptYears(
  partial: Partial<Record<GradeLevel, YearTranscript>>,
): Record<GradeLevel, YearTranscript> {
  const base = createEmptyTranscriptYears();
  for (const grade of GRADE_LEVELS) {
    const incoming = partial[grade];
    if (!incoming) continue;
    base[grade] = {
      grade,
      overallAverage: incoming.overallAverage,
      subjects: incoming.subjects ?? [],
    };
  }
  return base;
}
