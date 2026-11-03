import type { SupabaseClient } from '@supabase/supabase-js';

import { mergeAssessmentScoreMatrices } from '@/lib/career-assessment/merge-scores';
import { computeCareerProgress } from '@/lib/career-assessment/progress';
import type { SampleMajorSuggestion } from '@/lib/assessment/majors';
import { suggestTieredMajors } from '@/lib/assessment/majors';
import { normalizeCareerAssessmentRow } from '@/lib/student-dashboard/career-assessment-db';
import {
  fetchCareerAssessmentRowsForUser,
  loadCompletedCareerStages,
  loadStudentCareerSnapshot,
} from '@/lib/student-dashboard/load-career-assessment';
import {
  extractTopStrengthTraits,
  minimalAssessmentMatrixFromHolland,
  parseAssessmentScoreMatrix,
} from '@/lib/student-dashboard/parse-score-matrix';
import {
  loadStudentGoalsContext,
  parseUniversityIds,
} from '@/lib/student-profile/load-context';
import type { CognitiveKey } from '@/types/assessment';

const COGNITIVE_KEYS: CognitiveKey[] = [
  'analytical',
  'strategic',
  'focus_power',
  'relational',
];

const COGNITIVE_LABELS: Record<CognitiveKey, string> = {
  analytical: 'Analitik düşünme',
  strategic: 'Stratejik planlama',
  focus_power: 'Odak gücü',
  relational: 'İlişki kurma',
};

export interface StudentCareerInsightForTeacher {
  hasAssessment: boolean;
  studentName?: string;
  hollandCode?: string;
  hollandTitle?: string;
  topTraits: string[];
  cognitiveHighlights: string[];
  radarData: { axis: string; value: number }[];
  primaryMajors: SampleMajorSuggestion[];
  secondaryMajors: SampleMajorSuggestion[];
  suggestedMajors: string[];
  targetUniversities: {
    id: string;
    name: string;
    country: string;
    city: string | null;
  }[];
  aiInterpretation?: string | null;
  assessedAt?: string;
  progressPercent?: number;
}

export async function loadStudentCareerInsightForTeacher(
  client: SupabaseClient,
  studentId: string,
  studentName?: string,
): Promise<StudentCareerInsightForTeacher> {
  const empty: StudentCareerInsightForTeacher = {
    hasAssessment: false,
    studentName,
    topTraits: [],
    cognitiveHighlights: [],
    radarData: [],
    primaryMajors: [],
    secondaryMajors: [],
    suggestedMajors: [],
    targetUniversities: [],
  };

  const [career, goalsLoad, completedStages] = await Promise.all([
    loadStudentCareerSnapshot(client, studentId),
    loadStudentGoalsContext(client, studentId),
    loadCompletedCareerStages(client, studentId),
  ]);

  let targetUniversities: StudentCareerInsightForTeacher['targetUniversities'] =
    [];
  if (goalsLoad.ok) {
    const ids = parseUniversityIds(goalsLoad.data.targetUniversityIds);
    const options = goalsLoad.data.universities;
    targetUniversities = ids
      .map((id) => options.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => u !== undefined)
      .map((u) => ({
        id: u.id,
        name: u.name,
        country: u.country,
        city: u.city,
      }));
  }

  const progress = computeCareerProgress(completedStages);

  if (!career.hasAssessment) {
    return { ...empty, targetUniversities, progressPercent: progress.percent };
  }

  const rows = await fetchCareerAssessmentRowsForUser(client, studentId);
  const matrices = rows
    .map((row) => {
      const normalized = normalizeCareerAssessmentRow(row);
      return (
        parseAssessmentScoreMatrix(normalized.scoresRaw) ??
        (normalized.hollandCodeFallback
          ? minimalAssessmentMatrixFromHolland(normalized.hollandCodeFallback)
          : null)
      );
    })
    .filter((matrix): matrix is NonNullable<typeof matrix> => matrix !== null);

  const mergedScores =
    matrices.length > 0 ? mergeAssessmentScoreMatrices(matrices) : null;

  const cognitiveHighlights: string[] = [];
  if (mergedScores) {
    const ranked = [...COGNITIVE_KEYS].sort(
      (a, b) =>
        mergedScores.cognitive[b].percent - mergedScores.cognitive[a].percent,
    );
    for (const key of ranked.slice(0, 3)) {
      if (mergedScores.cognitive[key].percent > 0) {
        cognitiveHighlights.push(COGNITIVE_LABELS[key]);
      }
    }
  }

  const tiered =
    career.primaryMajors.length > 0
      ? {
          primaryMajors: career.primaryMajors,
          secondaryMajors: career.secondaryMajors,
        }
      : mergedScores
        ? suggestTieredMajors(mergedScores.topRiasec)
        : { primaryMajors: [], secondaryMajors: [] };

  return {
    hasAssessment: true,
    studentName,
    hollandCode: career.hollandCode,
    hollandTitle: career.hollandTitle,
    topTraits:
      career.topTraits.length > 0
        ? career.topTraits
        : mergedScores
          ? extractTopStrengthTraits(mergedScores)
          : [],
    cognitiveHighlights,
    radarData: career.radarData,
    primaryMajors: tiered.primaryMajors,
    secondaryMajors: tiered.secondaryMajors,
    suggestedMajors: [
      ...tiered.primaryMajors,
      ...tiered.secondaryMajors,
    ].map((m) => m.title),
    targetUniversities,
    aiInterpretation: career.aiInterpretation,
    assessedAt: career.assessedAt,
    progressPercent: progress.percent,
  };
}
