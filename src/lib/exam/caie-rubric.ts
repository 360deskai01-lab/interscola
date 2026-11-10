/**
 * Cambridge CAIE A-Level / AS-Level — Assessment Objectives (AO1–AO3) sözleşmesi.
 */

export const CAIE_AO_KEYS = [
  'ao1_knowledge',
  'ao2_application',
  'ao3_evaluation',
] as const;

export type CaieAoKey = (typeof CAIE_AO_KEYS)[number];

export interface CaieQuestionRubricCriteria {
  ao1_knowledge?: string;
  ao2_application?: string;
  ao3_evaluation?: string;
}

export interface CaieBreakdownNormalized {
  ao1_knowledge: number;
  ao2_application: number;
  ao3_evaluation: number;
  totalScore: number;
  maxMarks: number;
  percent: number;
  ao1Percent: number;
  ao2Percent: number;
  ao3Percent: number;
  cambridge_grade: string;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentOfPart(part: number, total: number): number {
  if (total <= 0) return 0;
  return roundTo2((part / total) * 100);
}

/**
 * Resmi yüzdelik harf baremi (yaklaşık oturum sınırları).
 */
export function calculateCaieGrade(
  totalScore: number,
  maxScore: number,
): string {
  if (!Number.isFinite(totalScore) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return 'U';
  }
  const percent = (totalScore / maxScore) * 100;
  if (percent >= 90) return 'A*';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  if (percent >= 40) return 'E';
  return 'U';
}

export function normalizeCaieBreakdown(
  ao1: number,
  ao2: number,
  ao3: number,
  maxMarks: number,
): CaieBreakdownNormalized {
  const ao1_knowledge = roundTo2(Math.max(0, ao1));
  const ao2_application = roundTo2(Math.max(0, ao2));
  const ao3_evaluation = roundTo2(Math.max(0, ao3));
  const totalScore = roundTo2(ao1_knowledge + ao2_application + ao3_evaluation);
  const safeMax = maxMarks > 0 ? maxMarks : totalScore > 0 ? totalScore : 1;
  const percent = roundTo2((totalScore / safeMax) * 100);

  return {
    ao1_knowledge,
    ao2_application,
    ao3_evaluation,
    totalScore,
    maxMarks: safeMax,
    percent,
    ao1Percent: percentOfPart(ao1_knowledge, totalScore),
    ao2Percent: percentOfPart(ao2_application, totalScore),
    ao3Percent: percentOfPart(ao3_evaluation, totalScore),
    cambridge_grade: calculateCaieGrade(totalScore, safeMax),
  };
}

function hasNonEmptyCriterion(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Soru rubriğinde en az bir AO (Knowledge / Application / Evaluation) kriteri olmalı. */
export function validateCaieQuestionRubric(
  rubric?: CaieQuestionRubricCriteria | null,
): boolean {
  if (!rubric || typeof rubric !== 'object') return false;
  return (
    hasNonEmptyCriterion(rubric.ao1_knowledge) ||
    hasNonEmptyCriterion(rubric.ao2_application) ||
    hasNonEmptyCriterion(rubric.ao3_evaluation)
  );
}

export function formatCaieScaledResult(
  grade: string,
  percent: number,
): string {
  if (grade === 'U' && percent === 0) {
    return 'Grade U';
  }
  return `Grade ${grade} (${roundTo2(percent)}%)`;
}

export function buildCaieMetricBreakdown(
  breakdown: CaieBreakdownNormalized,
  extra?: Record<string, number>,
): Record<string, number | string> {
  return {
    ao1_knowledge: breakdown.ao1_knowledge,
    ao2_application: breakdown.ao2_application,
    ao3_evaluation: breakdown.ao3_evaluation,
    cambridge_grade: breakdown.cambridge_grade,
    yuzde: breakdown.percent,
    ao1Percent: breakdown.ao1Percent,
    ao2Percent: breakdown.ao2Percent,
    ao3Percent: breakdown.ao3Percent,
    ...extra,
  };
}
