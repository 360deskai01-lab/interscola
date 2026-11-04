import type { CurriculumCode } from '@/types/exam';
import type { TestEtSlug } from '@/lib/test-et/test-et-config';

export const GUEST_DIAGNOSTIC_STORAGE_KEY = 'interscola_guest_diagnostic';

export type GuestDiagnosticQuestionBreakdown = {
  questionId: string;
  questionNumber: number;
  label: string;
  status: 'correct' | 'partial' | 'incorrect' | 'answered';
};

export type GuestDiagnosticRubricLine = {
  key: string;
  label: string;
  score: string;
};

export type GuestDiagnosticRecord = {
  curriculum: CurriculumCode;
  slug: TestEtSlug;
  completedAt: string;
  headlineScore: string;
  summary: string;
  answers: Record<string, string>;
  lockedTeaser: {
    questionBreakdown: GuestDiagnosticQuestionBreakdown[];
    rubricBreakdown: GuestDiagnosticRubricLine[];
    weakTopics: string[];
  };
};

export function parseGuestDiagnosticRecord(raw: string): GuestDiagnosticRecord | null {
  try {
    const parsed = JSON.parse(raw) as GuestDiagnosticRecord;
    if (!parsed?.curriculum || !parsed.headlineScore) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readGuestDiagnosticFromStorage(): GuestDiagnosticRecord | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(GUEST_DIAGNOSTIC_STORAGE_KEY);
  if (!raw) return null;
  return parseGuestDiagnosticRecord(raw);
}

export function writeGuestDiagnosticToStorage(record: GuestDiagnosticRecord): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_DIAGNOSTIC_STORAGE_KEY, JSON.stringify(record));
}
