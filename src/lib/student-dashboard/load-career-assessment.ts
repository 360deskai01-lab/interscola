import type { SupabaseClient } from '@supabase/supabase-js';

import { mergeAssessmentScoreMatrices } from '@/lib/career-assessment/merge-scores';
import {
  mapDbTypeToStage,
  type CareerCompassStageId,
} from '@/lib/career-assessment/progress';
import { suggestTieredMajors } from '@/lib/assessment/majors';
import { pickPrimaryRadarSeries } from '@/lib/assessment/radar-series';
import { buildCareerInventoryTriad } from '@/lib/career-assessment/inventory-triad';
import type { StudentCareerSnapshot } from '@/lib/student-command-center/types';
import {
  CAREER_ASSESSMENT_USER_SELECT,
  normalizeAssessmentType,
  normalizeCareerAssessmentRow,
  type CareerAssessmentDbRow,
} from '@/lib/student-dashboard/career-assessment-db';
import {
  ASSESSMENT_KIND_PRIORITY,
  extractHollandFromScoresRaw,
  extractTopStrengthTraits,
  minimalAssessmentMatrixFromHolland,
  parseAssessmentScoreMatrix,
} from '@/lib/student-dashboard/parse-score-matrix';
import type { AssessmentKind, AssessmentScoreMatrix } from '@/types/assessment';

const LEGACY_CAREER_ASSESSMENT_SELECT =
  'id, assessment_kind, score_matrix, holland_code, ai_report, top_traits, created_at';

const CAREER_ASSESSMENT_USER_SELECT_NO_HOLLAND =
  'id, assessment_type, scores, top_traits, ai_interpretation, created_at';

export async function fetchCareerAssessmentRowsForUser(
  client: SupabaseClient,
  userId: string,
): Promise<CareerAssessmentDbRow[]> {
  const live = await client
    .from('career_assessments')
    .select(CAREER_ASSESSMENT_USER_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(24);

  if (live.error?.code === '42703') {
    const liveNoHolland = await client
      .from('career_assessments')
      .select(CAREER_ASSESSMENT_USER_SELECT_NO_HOLLAND)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(24);
    if (!liveNoHolland.error) {
      return (liveNoHolland.data ?? []) as CareerAssessmentDbRow[];
    }
  }

  if (live.error?.code === '42703') {
    const legacy = await client
      .from('career_assessments')
      .select(LEGACY_CAREER_ASSESSMENT_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(24);
    return (legacy.data ?? []) as CareerAssessmentDbRow[];
  }

  if (live.error) {
    if (live.error.code !== '42P01') {
      console.error(
        '[student-dashboard] Kariyer kaydı okunamadı:',
        live.error.message,
      );
    }
    return [];
  }

  return (live.data ?? []) as CareerAssessmentDbRow[];
}

export async function loadCompletedCareerStages(
  client: SupabaseClient,
  userId: string,
): Promise<Set<CareerCompassStageId>> {
  const rows = await fetchCareerAssessmentRowsForUser(client, userId);
  const completed = new Set<CareerCompassStageId>();
  for (const row of rows) {
    const norm = normalizeCareerAssessmentRow(row);
    const stage = mapDbTypeToStage(norm.assessmentType);
    if (stage) completed.add(stage);
  }
  return completed;
}

function parseRowToMatrix(
  row: CareerAssessmentDbRow,
): AssessmentScoreMatrix | null {
  const normalized = normalizeCareerAssessmentRow(row);
  const parsed = parseAssessmentScoreMatrix(normalized.scoresRaw);
  if (parsed) return parsed;

  if (normalized.hollandCodeFallback) {
    return minimalAssessmentMatrixFromHolland(normalized.hollandCodeFallback);
  }

  return null;
}

function pickPreferredRowMeta(
  rows: CareerAssessmentDbRow[],
): {
  kind: AssessmentKind;
  normalized: ReturnType<typeof normalizeCareerAssessmentRow>;
} | null {
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

  const top = sorted[0];
  if (!top) return null;
  const normalized = normalizeCareerAssessmentRow(top);
  const kind =
    normalizeAssessmentType(normalized.assessmentType) ?? 'quick_combo';
  return { kind, normalized };
}

function emptyInventoryTriad(): StudentCareerSnapshot['inventoryTriad'] {
  return {
    cards: [],
    synthesis: { primaryMajors: [], secondaryMajors: [] },
    completedStageCount: 0,
    totalStages: 3,
    progressPercent: 0,
  };
}

function buildSnapshotFromScores(
  scores: AssessmentScoreMatrix,
  meta: {
    kind: AssessmentKind;
    normalized: ReturnType<typeof normalizeCareerAssessmentRow>;
  },
  completedStages: Set<CareerCompassStageId>,
): StudentCareerSnapshot {
  const hollandCode =
    meta.normalized.hollandCodeFallback || scores.hollandCode || undefined;
  const hollandTitle = scores.hollandTitle || hollandCode;

  const topTraits =
    meta.normalized.topTraits.length > 0
      ? meta.normalized.topTraits
      : extractTopStrengthTraits(scores);

  const inventoryTriad = buildCareerInventoryTriad(scores, completedStages);
  const { primaryMajors, secondaryMajors } = inventoryTriad.synthesis;

  return {
    hasAssessment: true,
    assessmentKind: meta.kind,
    hollandCode,
    hollandTitle,
    topTraits,
    radarData: pickPrimaryRadarSeries(scores),
    aiInterpretation: meta.normalized.aiInterpretation,
    assessedAt: meta.normalized.createdAt,
    primaryMajors,
    secondaryMajors,
    suggestedMajors: [...primaryMajors, ...secondaryMajors].map((m) => m.title),
    pinnedUniversityNames: [],
    inventoryTriad,
  };
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
    inventoryTriad: emptyInventoryTriad(),
  };

  const [rows, completedStages] = await Promise.all([
    fetchCareerAssessmentRowsForUser(client, userId),
    loadCompletedCareerStages(client, userId),
  ]);
  if (rows.length === 0) {
    return empty;
  }

  const matrices: AssessmentScoreMatrix[] = [];
  for (const row of rows) {
    const matrix = parseRowToMatrix(row);
    if (matrix) matrices.push(matrix);
  }

  const meta = pickPreferredRowMeta(rows);
  if (!meta) {
    return empty;
  }

  let scores: AssessmentScoreMatrix | null = null;
  if (matrices.length > 0) {
    scores = mergeAssessmentScoreMatrices(matrices);
  }

  if (!scores && meta.normalized.hollandCodeFallback) {
    scores = minimalAssessmentMatrixFromHolland(
      meta.normalized.hollandCodeFallback,
    );
  }

  if (!scores) {
    for (const row of rows) {
      const normalized = normalizeCareerAssessmentRow(row);
      const holland =
        normalized.hollandCodeFallback ??
        extractHollandFromScoresRaw(normalized.scoresRaw);
      if (holland) {
        scores = minimalAssessmentMatrixFromHolland(holland);
        break;
      }
    }
  }

  if (!scores) {
    return empty;
  }

  return buildSnapshotFromScores(scores, meta, completedStages);
}
