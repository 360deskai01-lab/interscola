export type GradeLevel = 10 | 11 | 12;

export const GRADE_LEVELS: GradeLevel[] = [10, 11, 12];

export interface SubjectRecord {
  id: string;
  name: string;
  score100: number;
  weeklyHours: number;
}

export interface YearTranscript {
  grade: GradeLevel;
  overallAverage?: number;
  subjects?: SubjectRecord[];
}

export interface AcademicTranscriptData {
  years: Record<GradeLevel, YearTranscript>;
  cumulative100: number;
  gpa4Scale: number;
  wesEquivalentGrade: string;
  updatedAt?: string;
}

/** Boş form / DB `{}` için üç sınıf iskeleti. */
export function createEmptyTranscriptYears(): Record<
  GradeLevel,
  YearTranscript
> {
  return {
    10: { grade: 10, subjects: [] },
    11: { grade: 11, subjects: [] },
    12: { grade: 12, subjects: [] },
  };
}

export function createEmptyAcademicTranscript(): AcademicTranscriptData {
  return {
    years: createEmptyTranscriptYears(),
    cumulative100: 0,
    gpa4Scale: 0,
    wesEquivalentGrade: '—',
  };
}
