import type { SupabaseClient } from '@supabase/supabase-js';

import { riasecRadarData } from '@/lib/assessment/scoring';
import { suggestSampleMajors } from '@/lib/assessment/majors';
import type { StudentCareerSnapshot } from '@/lib/student-command-center/types';
import {
  ASSESSMENT_KIND_PRIORITY,
  extractTopStrengthTraits,
  isAssessmentKind,
  parseAssessmentScoreMatrix,
} from '@/lib/student-dashboard/parse-score-matrix';
import type { AssessmentKind } from '@/types/assessment';

type CareerRow = {
  assessment_kind: string;
  score_matrix: unknown;
  holland_code: string | null;
  ai_report: string | null;
  created_at: string;
};

function pickPreferredAssessment(rows: CareerRow[]): CareerRow | null {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => {
    const pa = isAssessmentKind(a.assessment_kind)
      ? ASSESSMENT_KIND_PRIORITY[a.assessment_kind]
      : 0;
    const pb = isAssessmentKind(b.assessment_kind)
      ? ASSESSMENT_KIND_PRIORITY[b.assessment_kind]
      : 0;
    if (pb !== pa) return pb - pa;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
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
    suggestedMajors: [],
    pinnedUniversityNames: [],
  };

  const { data, error } = await client
    .from('career_assessments')
    .select(
      'assessment_kind, score_matrix, holland_code, ai_report, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    if (error.code === '42P01') {
      return empty;
    }
    console.error('[student-dashboard] Kariyer kaydı okunamadı:', error.message);
    return empty;
  }

  const row = pickPreferredAssessment((data ?? []) as CareerRow[]);
  if (!row) {
    return empty;
  }

  const scores = parseAssessmentScoreMatrix(row.score_matrix);
  if (!scores) {
    return empty;
  }

  const kind = isAssessmentKind(row.assessment_kind)
    ? row.assessment_kind
    : ('quick_combo' as AssessmentKind);

  const hollandCode =
    row.holland_code?.trim() || scores.hollandCode || undefined;
  const hollandTitle = scores.hollandTitle || hollandCode;

  return {
    hasAssessment: true,
    assessmentKind: kind,
    hollandCode,
    hollandTitle,
    topTraits: extractTopStrengthTraits(scores),
    radarData: riasecRadarData(scores).map(({ axis, value }) => ({
      axis,
      value,
    })),
    aiInterpretation: row.ai_report?.trim() || null,
    assessedAt: row.created_at,
    suggestedMajors: suggestSampleMajors(scores.topRiasec).map((m) => m.title),
    pinnedUniversityNames: [],
  };
}
