import type { AssessmentPayload, CurriculumCode } from '@/types/exam';

/** Canlı üretim / kütüphane oturum hacmi — resmi tam sınav değildir. */
export type ExamSessionFormatId = 'diagnostic_drill' | 'mini_mock';

export const DIAGNOSTIC_DRILL_QUESTIONS: Record<CurriculumCode, number> = {
  SAT: 4,
  IELTS: 1,
  CAIE: 1,
};

export const MINI_MOCK_QUESTIONS: Record<CurriculumCode, number> = {
  SAT: 11,
  IELTS: 2,
  CAIE: 2,
};

export const DIAGNOSTIC_DRILL_DURATION_MINUTES = 15;
export const MINI_MOCK_DURATION_MINUTES = 18;

export function inferSessionFormat(
  exam: AssessmentPayload,
): ExamSessionFormatId {
  const title = exam.title.toLowerCase();
  if (
    title.includes('mini deneme') ||
    title.includes('section practice')
  ) {
    return 'mini_mock';
  }
  if (
    title.includes('diagnostic drill') ||
    title.includes('mikro alıştırma') ||
    title.includes('mikro')
  ) {
    return 'diagnostic_drill';
  }
  if (exam.questions.length >= 10) return 'mini_mock';
  return 'diagnostic_drill';
}

export function questionCountForSessionFormat(
  format: ExamSessionFormatId,
  curriculum: CurriculumCode,
): number {
  return format === 'mini_mock'
    ? MINI_MOCK_QUESTIONS[curriculum]
    : DIAGNOSTIC_DRILL_QUESTIONS[curriculum];
}

export function durationMinutesForSessionFormat(
  format: ExamSessionFormatId,
): number {
  return format === 'mini_mock'
    ? MINI_MOCK_DURATION_MINUTES
    : DIAGNOSTIC_DRILL_DURATION_MINUTES;
}

export function sessionFormatTitlePrefix(
  format: ExamSessionFormatId,
): string {
  if (format === 'mini_mock') {
    return 'Mini Deneme (Section Practice · 10–12 Soru / 15–20 Dk)';
  }
  return 'Diagnostic Drill (Mikro Alıştırma · 3–5 Soru)';
}

export function trimExamToQuestionCount(
  exam: AssessmentPayload,
  questionCount: number,
): AssessmentPayload {
  const questions = exam.questions.slice(0, Math.max(1, questionCount));
  const totalMarks = questions.reduce(
    (sum, question) => sum + (question.targetMarks ?? 0),
    0,
  );
  return {
    ...exam,
    questions,
    totalMarks: totalMarks > 0 ? totalMarks : exam.totalMarks,
  };
}

export function decorateExamForSessionFormat(
  exam: AssessmentPayload,
  format: ExamSessionFormatId,
  curriculum: CurriculumCode,
): AssessmentPayload {
  const targetCount = questionCountForSessionFormat(format, curriculum);
  const trimmed = trimExamToQuestionCount(exam, targetCount);
  const baseTitle = trimmed.title.replace(
    /^(Diagnostic Drill|Mini Deneme)[^—]*—\s*/i,
    '',
  );
  return {
    ...trimmed,
    title: `${sessionFormatTitlePrefix(format)} — ${baseTitle}`,
    durationMinutes: durationMinutesForSessionFormat(format),
  };
}

export function sessionFormatUiLabel(format: ExamSessionFormatId): string {
  return format === 'mini_mock'
    ? 'Mini Deneme (Section Practice)'
    : 'Diagnostic Drill (Mikro Alıştırma)';
}

export function questionCountOptionsForHome(
  format: ExamSessionFormatId,
  curriculum: CurriculumCode,
  maxQuestions: number,
): number[] {
  if (format === 'mini_mock') {
    if (curriculum === 'SAT') {
      return [10, 11, 12].filter((n) => n <= maxQuestions);
    }
    if (curriculum === 'IELTS') return [1, 2].filter((n) => n <= maxQuestions);
    return [2, 3].filter((n) => n <= maxQuestions);
  }
  if (curriculum === 'SAT') {
    return [3, 4, 5].filter((n) => n <= maxQuestions);
  }
  if (curriculum === 'IELTS') {
    return Array.from({ length: maxQuestions }, (_, i) => i + 1);
  }
  return Array.from({ length: maxQuestions }, (_, i) => i + 1);
}

export function defaultQuestionCountForHome(
  format: ExamSessionFormatId,
  curriculum: CurriculumCode,
): number {
  return questionCountForSessionFormat(format, curriculum);
}
