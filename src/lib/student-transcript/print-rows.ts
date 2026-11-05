import {
  resolveYearAverage100,
  score100ToGpaPoint,
  wesLetterFromCumulative100,
} from '@/lib/student-transcript/gpa-calculator';
import {
  GRADE_LEVELS,
  type AcademicTranscriptData,
  type GradeLevel,
  type SubjectRecord,
  type YearTranscript,
} from '@/lib/student-transcript/types';

export interface TranscriptPrintRow {
  courseTitle: string;
  weeklyHours: number;
  numericGrade: number;
  usLetter: string;
  gradePoints: number;
}

const GRADE_LABEL: Record<GradeLevel, string> = {
  10: '10th Grade',
  11: '11th Grade',
  12: '12th Grade',
};

export function gradeLevelEnglishLabel(grade: GradeLevel): string {
  return GRADE_LABEL[grade];
}

function subjectToRow(subject: SubjectRecord): TranscriptPrintRow | null {
  const name = subject.name.trim();
  if (!name) return null;
  if (
    !Number.isFinite(subject.score100) ||
    subject.score100 < 0 ||
    subject.score100 > 100
  ) {
    return null;
  }
  if (
    !Number.isFinite(subject.weeklyHours) ||
    subject.weeklyHours <= 0
  ) {
    return null;
  }
  return {
    courseTitle: name,
    weeklyHours: subject.weeklyHours,
    numericGrade: Math.round(subject.score100 * 100) / 100,
    usLetter: wesLetterFromCumulative100(subject.score100),
    gradePoints: score100ToGpaPoint(subject.score100),
  };
}

export function buildPrintRowsForYear(
  year: YearTranscript,
): { rows: TranscriptPrintRow[]; yearAverage: number | null } {
  const subjects = year.subjects ?? [];
  const rows = subjects
    .map(subjectToRow)
    .filter((row): row is TranscriptPrintRow => row !== null);

  if (rows.length > 0) {
    return { rows, yearAverage: resolveYearAverage100(year) };
  }

  const yearAverage = resolveYearAverage100(year);
  if (yearAverage === null) {
    return { rows: [], yearAverage: null };
  }

  return {
    yearAverage,
    rows: [
      {
        courseTitle: 'Year-End General Average (Official)',
        weeklyHours: 0,
        numericGrade: Math.round(yearAverage * 100) / 100,
        usLetter: wesLetterFromCumulative100(yearAverage),
        gradePoints: score100ToGpaPoint(yearAverage),
      },
    ],
  };
}

export function transcriptHasPrintableGrades(
  transcript: AcademicTranscriptData,
): boolean {
  for (const grade of GRADE_LEVELS) {
    const { rows } = buildPrintRowsForYear(transcript.years[grade]);
    if (rows.length > 0) return true;
  }
  return false;
}
