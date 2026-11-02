import type { SupabaseClient } from '@supabase/supabase-js';

import { suggestTieredMajors } from '@/lib/assessment/majors';
import { riasecRadarData } from '@/lib/assessment/scoring';
import type { StudentCareerSnapshot } from '@/lib/student-command-center/types';
import {
  CAREER_ASSESSMENT_USER_SELECT,
  normalizeAssessmentType,
  normalizeCareerAssessmentRow,
  type CareerAssessmentDbRow,
} from '@/lib/student-dashboard/career-assessment-db';
import {
  ASSESSMENT_KIND_PRIORITY,
  extractTopStrengthTraits,
  parseAssessmentScoreMatrix,
} from '@/lib/student-dashboard/parse-score-matrix';
import type { AssessmentKind } from '@/types/assessment';

const LEGACY_CAREER_ASSESSMENT_SELECT =
  'id, assessment_kind, score_matrix, holland_code, ai_report, created_at';

function pickPreferredAssessment(
  rows: CareerAssessmentDbRow[],
): CareerAssessmentDbRow | null {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => {
    const normA = normalizeCareerAssessmentRow(a);
    const normB = normalizeCareerAssessmentRow(b);
    const typeA = normalizeAssessmentType(normA.assessmentType);
    const typeB = normalizeAssessmentType(normB.assessmentType);
    const pa = typeA ? ASSESSMENT_KIND_PRIORITY[typeA] : 0;
    const pb = typeB ? ASSESSMENT_KIND_PRIORITY[typeB] : 0;
    if (pb !== pa) return pb - pa;
    return Date.parse(normB.createdAt) - Date.parse(normA.createdAt);
  });

  return sorted[0] ?? null;
}

export async function loadStudentCareerSnapshot(
  client: SupabaseClient,
  userId: string,
): Promise<StudentCareerSnapshot> {
  const empty: StudentCareerSnapshot = {
    hasAssessment: false,
    topTraits: [],
    radarData: [],
    primaryMajors: [],
    secondaryMajors: [],
    suggestedMajors: [],
    pinnedUniversityNames: [],
  };

  let rows: CareerAssessmentDbRow[] | null = null;
  let error: { code?: string; message: string } | null = null;

  const live = await client
    .from('career_assessments')
    .select(CAREER_ASSESSMENT_USER_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  rows = (live.data ?? null) as CareerAssessmentDbRow[] | null;
  error = live.error;

  if (error?.code === '42703') {
    const legacy = await client
      .from('career_assessments')
      .select(LEGACY_CAREER_ASSESSMENT_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12);
    rows = (legacy.data ?? null) as CareerAssessmentDbRow[] | null;
    error = legacy.error;
  }

  if (error) {
    if (error.code === '42P01') {
      return empty;
    }
    console.error('[student-dashboard] Kariyer kaydı okunamadı:', error.message);
    return empty;
  }

  const row = pickPreferredAssessment(rows ?? []);
  if (!row) {
    return empty;
  }

  const normalized = normalizeCareerAssessmentRow(row);
  const scores = parseAssessmentScoreMatrix(normalized.scoresRaw);
  if (!scores) {
    return empty;
  }

  const kind =
    normalizeAssessmentType(normalized.assessmentType) ??
    ('quick_combo' as AssessmentKind);

  const hollandCode =
    normalized.hollandCodeFallback || scores.hollandCode || undefined;
  const hollandTitle = scores.hollandTitle || hollandCode;

  const topTraits =
    normalized.topTraits.length > 0
      ? normalized.topTraits
      : extractTopStrengthTraits(scores);

  const tiered = suggestTieredMajors(scores.topRiasec);

  return {
    hasAssessment: true,
    assessmentKind: kind,
    hollandCode,
    hollandTitle,
    topTraits,
    radarData: riasecRadarData(scores).map(({ axis, value }) => ({
      axis,
      value,
    })),
    aiInterpretation: normalized.aiInterpretation,
    assessedAt: normalized.createdAt,
    primaryMajors: tiered.primaryMajors,
    secondaryMajors: tiered.secondaryMajors,
    suggestedMajors: [
      ...tiered.primaryMajors,
      ...tiered.secondaryMajors,
    ].map((m) => m.title),
    pinnedUniversityNames: [],
  };
}
