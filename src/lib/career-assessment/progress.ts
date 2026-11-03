import type { AssessmentKind } from '@/types/assessment';
import { normalizeAssessmentType } from '@/lib/student-dashboard/career-assessment-db';

/** Kümülatif pusula yolu (3 aşama). */
export const CAREER_COMPASS_STAGE_ORDER = [
  'quick_combo',
  'deep_big_five',
  'deep_cognitive',
] as const satisfies readonly AssessmentKind[];

export type CareerCompassStageId = (typeof CAREER_COMPASS_STAGE_ORDER)[number];

export const CAREER_STAGE_LABELS: Record<CareerCompassStageId, string> = {
  quick_combo: 'Hızlı Kombo Pusula (24 soru)',
  deep_big_five: 'Kişilik & Çalışma Stili (Big Five)',
  deep_cognitive: 'Bilişsel Güçler Envanteri',
};

export const CAREER_STAGE_CTA: Record<
  CareerCompassStageId,
  { emoji: string; label: string }
> = {
  quick_combo: {
    emoji: '🚀',
    label: '1. Aşama: Hızlı Kombo Pusulayı Başlat',
  },
  deep_big_five: {
    emoji: '🚀',
    label: '2. Aşamaya Geç: Kişilik & Çalışma Stili (Big Five)',
  },
  deep_cognitive: {
    emoji: '🚀',
    label: '3. Aşamaya Geç: Bilişsel Güçler Envanteri',
  },
};

export function mapDbTypeToStage(
  assessmentType: string,
): CareerCompassStageId | null {
  const kind = normalizeAssessmentType(assessmentType);
  if (!kind) return null;
  if (kind === 'quick_combo' || kind === 'deep_riasec') {
    return 'quick_combo';
  }
  if (kind === 'deep_big_five') return 'deep_big_five';
  if (kind === 'deep_cognitive') return 'deep_cognitive';
  return null;
}

export function computeCareerProgress(completedStages: Set<CareerCompassStageId>): {
  percent: number;
  completedCount: number;
  total: number;
  nextStage: CareerCompassStageId | null;
} {
  const total = CAREER_COMPASS_STAGE_ORDER.length;
  let completedCount = 0;
  for (const stage of CAREER_COMPASS_STAGE_ORDER) {
    if (completedStages.has(stage)) completedCount += 1;
  }
  const percent = Math.round((completedCount / total) * 100);
  const nextStage =
    CAREER_COMPASS_STAGE_ORDER.find((stage) => !completedStages.has(stage)) ??
    null;
  return { percent, completedCount, total, nextStage };
}

export function assessmentKindForStage(
  stage: CareerCompassStageId,
): AssessmentKind {
  return stage;
}
