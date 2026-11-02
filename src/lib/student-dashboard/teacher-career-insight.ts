import type { SupabaseClient } from '@supabase/supabase-js';

import { suggestSampleMajors } from '@/lib/assessment/majors';
import {
  extractTopStrengthTraits,
  parseAssessmentScoreMatrix,
} from '@/lib/student-dashboard/parse-score-matrix';
import { loadStudentCareerSnapshot } from '@/lib/student-dashboard/load-career-assessment';
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
  suggestedMajors: string[];
  targetUniversities: { id: string; name: string; country: string; city: string | null }[];
  aiInterpretation?: string | null;
  assessedAt?: string;
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
    suggestedMajors: [],
    targetUniversities: [],
  };

  const [career, goalsLoad] = await Promise.all([
    loadStudentCareerSnapshot(client, studentId),
    loadStudentGoalsContext(client, studentId),
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

  if (!career.hasAssessment) {
    return { ...empty, targetUniversities };
  }

  const cognitiveHighlights: string[] = [];
  const { data: rawRow } = await client
    .from('career_assessments')
    .select('score_matrix')
    .eq('user_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const scores = parseAssessmentScoreMatrix(
    (rawRow as { score_matrix?: unknown } | null)?.score_matrix,
  );
  if (scores) {
    const ranked = [...COGNITIVE_KEYS].sort(
      (a, b) => scores.cognitive[b].percent - scores.cognitive[a].percent,
    );
    for (const key of ranked.slice(0, 3)) {
      cognitiveHighlights.push(COGNITIVE_LABELS[key]);
    }
  }

  const majors = scores
    ? suggestSampleMajors(scores.topRiasec).map((m) => m.title)
    : career.suggestedMajors;

  return {
    hasAssessment: true,
    studentName,
    hollandCode: career.hollandCode,
    hollandTitle: career.hollandTitle,
    topTraits:
      career.topTraits.length > 0
        ? career.topTraits
        : scores
          ? extractTopStrengthTraits(scores)
          : [],
    cognitiveHighlights,
    suggestedMajors: majors,
    targetUniversities,
    aiInterpretation: career.aiInterpretation,
    assessedAt: career.assessedAt,
  };
}
