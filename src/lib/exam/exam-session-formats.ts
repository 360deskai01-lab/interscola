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

/** IELTS / CAIE diagnostic yazma görevleri için taban süre. */
export const DIAGNOSTIC_DRILL_DURATION_MINUTES = 15;
/** CAIE / A-Level teşhis için mutlak alt süre (dakika). */
export const CAIE_DIAGNOSTIC_ABSOLUTE_MIN_MINUTES = 12;
/** Digital SAT diagnostic (3–5 soru) taban süre. */
export const DIAGNOSTIC_DRILL_SAT_DURATION_MINUTES = 8;
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
  curriculum: CurriculumCode = 'SAT',
): number {
  if (format === 'mini_mock') {
    return MINI_MOCK_DURATION_MINUTES;
  }
  if (curriculum === 'SAT') {
    return DIAGNOSTIC_DRILL_SAT_DURATION_MINUTES;
  }
  return DIAGNOSTIC_DRILL_DURATION_MINUTES;
}

/**
 * Oturum formatı + müfredat için minimum süre (dakika).
 */
export function minimumDurationMinutesForSession(
  format: ExamSessionFormatId,
  curriculum: CurriculumCode,
): number {
  return durationMinutesForSessionFormat(format, curriculum);
}

const MAX_MINUTES_BEFORE_SECONDS_HEURISTIC = 90;

function applyCaieDiagnosticDurationFloor(
  exam: AssessmentPayload,
  seconds: number,
): number {
  if (exam.curriculum !== 'CAIE') return seconds;
  return Math.max(seconds, CAIE_DIAGNOSTIC_ABSOLUTE_MIN_MINUTES * 60);
}

/**
 * `durationMinutes` alanını saniyeye çevirir; taban süre kalkanı ve birim karışıklığı koruması.
 */
export function resolveExamSessionDurationSeconds(
  exam: AssessmentPayload,
): number {
  const format = inferSessionFormat(exam);
  const minMinutes = minimumDurationMinutesForSession(format, exam.curriculum);
  const minSeconds = minMinutes * 60;

  let minutes = exam.durationMinutes;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return applyCaieDiagnosticDurationFloor(exam, minSeconds);
  }

  minutes = Math.trunc(minutes);

  // durationMinutes alanına saniye yazılmış (ör. 15 sn) veya tabanın altında kalmış değer.
  if (minutes < minMinutes && minutes <= MAX_MINUTES_BEFORE_SECONDS_HEURISTIC) {
    return applyCaieDiagnosticDurationFloor(exam, minSeconds);
  }

  // Saniye değeri dakika alanına sığmış (ör. 900 = 15 dk).
  if (minutes > 600) {
    return applyCaieDiagnosticDurationFloor(
      exam,
      Math.max(minSeconds, minutes),
    );
  }

  const effectiveMinutes = Math.max(minutes, minMinutes);
  return applyCaieDiagnosticDurationFloor(exam, effectiveMinutes * 60);
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
    durationMinutes: durationMinutesForSessionFormat(format, curriculum),
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
