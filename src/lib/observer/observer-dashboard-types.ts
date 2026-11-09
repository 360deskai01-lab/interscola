import type { WeaknessTopicCount } from '@/lib/b2b/weakness-ledger-topics';

export interface ObserverAttemptHistoryRow {
  id: string;
  examTitle: string;
  curriculum: string;
  scaledResult: string;
  percentage: number;
  createdAt: string;
}

export interface ObserverTimelinePoint {
  createdAt: string;
  curriculum: string;
  scaledResult: string;
  percentage: number;
}

export interface ObserverDashboardViewData {
  studentDisplayName: string;
  targetExamKey: string | null;
  targetExamLabel: string;
  targetScoreLabel: string;
  currentLevelLabel: string;
  attemptCount: number;
  overallSuccessPercent: number;
  attemptHistory: ObserverAttemptHistoryRow[];
  timeline: ObserverTimelinePoint[];
  topWeaknessTopics: WeaknessTopicCount[];
  generatedAt: string;
}

export const OBSERVER_INVALID_TOKEN_ERROR =
  'GEÇERSİZ_VEYA_SÜRESİ_DOLMUŞ_BAĞLANTI' as const;
