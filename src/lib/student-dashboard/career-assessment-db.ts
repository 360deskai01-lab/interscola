import type { AssessmentKind } from '@/types/assessment';

/** Canlı `public.career_assessments` okuma sözleşmesi. */
export const CAREER_ASSESSMENT_USER_SELECT =
  'id, assessment_type, scores, top_traits, ai_interpretation, created_at';

export type CareerAssessmentDbRow = {
  id: string;
  assessment_type?: string;
  scores?: unknown;
  top_traits?: unknown;
  ai_interpretation?: string | null;
  created_at: string;
  assessment_kind?: string;
  score_matrix?: unknown;
  holland_code?: string | null;
  ai_report?: string | null;
};

export function normalizeAssessmentType(raw: string): AssessmentKind | null {
  const normalized = raw.trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'quick_combo' || normalized === 'quick') {
    return 'quick_combo';
  }
  if (normalized === 'deep_riasec') return 'deep_riasec';
  if (normalized === 'deep_big_five') return 'deep_big_five';
  if (normalized === 'deep_cognitive') return 'deep_cognitive';
  return null;
}

export function parseTopTraitsFromDb(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Satırı canlı veya legacy kolon adlarından normalize eder. */
export function normalizeCareerAssessmentRow(
  row: CareerAssessmentDbRow,
): {
  id: string;
  assessmentType: string;
  scoresRaw: unknown;
  topTraits: string[];
  aiInterpretation: string | null;
  hollandCodeFallback: string | null;
  createdAt: string;
} {
  const assessmentType =
    row.assessment_type?.trim() ||
    row.assessment_kind?.trim() ||
    'quick_combo';

  const scoresRaw =
    row.scores !== undefined && row.scores !== null
      ? row.scores
      : row.score_matrix;

  const topTraits =
    parseTopTraitsFromDb(row.top_traits).length > 0
      ? parseTopTraitsFromDb(row.top_traits)
      : [];

  const aiInterpretation =
    row.ai_interpretation?.trim() ||
    row.ai_report?.trim() ||
    null;

  return {
    id: row.id,
    assessmentType,
    scoresRaw,
    topTraits,
    aiInterpretation,
    hollandCodeFallback: row.holland_code?.trim() || null,
    createdAt: row.created_at,
  };
}
