import { countWords } from '@/lib/exam-shared';
import type { GuestDiagnosticRecord } from '@/lib/test-et/guest-diagnostic-storage';
import type {
  AssessmentPayload,
  CurriculumCode,
  EngineType,
  ExamQuestion,
} from '@/types/exam';
import type { TestEtSlug } from '@/lib/test-et/test-et-config';

export const GUEST_DIAGNOSTIC_CLAIM_SCHEMA_VERSION = 1 as const;

export type GuestDiagnosticClaimPayload = {
  version: typeof GUEST_DIAGNOSTIC_CLAIM_SCHEMA_VERSION;
  examTitle: string;
  curriculum: CurriculumCode;
  engineType: EngineType;
  subject: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  scaledResult: string;
  metricBreakdown: Record<string, number | string>;
  is_timed_out?: boolean;
  completedAt: string;
  slug: TestEtSlug;
  studentAnswers: Record<string, string>;
  summary: string;
};

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeMcqAnswer(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase().slice(0, 1);
}

function isMcqCorrect(question: ExamQuestion, answer: string | undefined): boolean {
  const selected = normalizeMcqAnswer(answer);
  const expected = normalizeMcqAnswer(question.correctAnswer);
  return selected.length > 0 && selected === expected;
}

function satScoreFromRatio(ratio: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(800 + clamped * 800);
}

function estimateIeltsBand(words: number, hasStructure: boolean): number {
  let band = 5.0;
  if (words >= 120) band = 6.0;
  if (words >= 180) band = 6.5;
  if (words >= 250) band = 7.0;
  if (words >= 320) band = 7.5;
  if (hasStructure && words >= 200) band += 0.5;
  return Math.min(8.5, Math.round(band * 2) / 2);
}

/** Misafir teşhis kaydından DB claim ve baseline senkronu için normalize payload. */
export function buildGuestDiagnosticClaimPayload(
  exam: AssessmentPayload,
  record: GuestDiagnosticRecord,
): GuestDiagnosticClaimPayload {
  const answers = record.answers;
  let rawScore = 0;
  let maxScore = exam.totalMarks > 0 ? exam.totalMarks : 1;
  const metricBreakdown: Record<string, number | string> = {};

  if (exam.curriculum === 'SAT') {
    const mcq = exam.questions.filter((q) => q.type === 'multiple_choice');
    const correct = mcq.filter((q) => isMcqCorrect(q, answers[q.id])).length;
    const ratio = mcq.length > 0 ? correct / mcq.length : 0;
    rawScore = satScoreFromRatio(ratio);
    maxScore = 1600;
    metricBreakdown.dogru = correct;
    metricBreakdown.bos = mcq.length - correct;
    metricBreakdown.dogrulukYuzdesi = roundTo2(ratio * 100);
  } else if (exam.curriculum === 'IELTS') {
    const essay = exam.questions.find((q) => q.type === 'extended_essay');
    const text = answers[essay?.id ?? ''] ?? '';
    const words = countWords(text);
    const band = estimateIeltsBand(
      words,
      text.includes('\n') || text.length > 400,
    );
    rawScore = band;
    maxScore = 9;
    metricBreakdown.kelime = words;
    metricBreakdown.genelBand = band;
  } else {
    let earned = 0;
    let max = 0;
    for (const question of exam.questions) {
      max += question.targetMarks;
      if (question.type === 'multiple_choice') {
        if (isMcqCorrect(question, answers[question.id])) {
          earned += question.targetMarks;
        }
      } else {
        const words = countWords(answers[question.id] ?? '');
        if (words >= 40) earned += Math.round(question.targetMarks * 0.55);
        else if (words >= 15) earned += Math.round(question.targetMarks * 0.35);
      }
    }
    rawScore = earned;
    maxScore = max > 0 ? max : exam.totalMarks;
    metricBreakdown.yuzde =
      maxScore > 0 ? roundTo2((earned / maxScore) * 100) : 0;
  }

  const percentage =
    maxScore > 0 ? roundTo2((rawScore / maxScore) * 100) : 0;

  return {
    version: GUEST_DIAGNOSTIC_CLAIM_SCHEMA_VERSION,
    examTitle: exam.title,
    curriculum: exam.curriculum,
    engineType: exam.engineType,
    subject: exam.subject,
    rawScore,
    maxScore,
    percentage,
    scaledResult: record.headlineScore,
    metricBreakdown,
    is_timed_out: record.is_timed_out,
    completedAt: record.completedAt,
    slug: record.slug,
    studentAnswers: answers,
    summary: record.summary,
  };
}
