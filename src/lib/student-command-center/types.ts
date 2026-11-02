import type { SampleMajorSuggestion } from '@/lib/assessment/majors';
import type { UniversityThresholdProgress } from '@/lib/student-dashboard/university-threshold-progress';
import type { StudentGoalsContext } from '@/lib/student-profile/types';
import type { AssessmentKind } from '@/types/assessment';
import type { StudentLatestScores, University } from '@/lib/universities/types';
import type { StudentRecentScores } from '@/lib/student-command-center/attempt-scores';

export interface StudentCareerSnapshot {
  hasAssessment: boolean;
  assessmentKind?: AssessmentKind;
  hollandCode?: string;
  hollandTitle?: string;
  topTraits: string[];
  radarData: { axis: string; value: number }[];
  aiInterpretation?: string | null;
  assessedAt?: string;
  primaryMajors: SampleMajorSuggestion[];
  secondaryMajors: SampleMajorSuggestion[];
  /** Öğretmen özeti için düz liste (birincil + ikincil başlıklar) */
  suggestedMajors: string[];
  pinnedUniversityNames: string[];
}

export interface StudentCommandCenterData {
  goals: StudentGoalsContext;
  pinnedUniversities: University[];
  /** Hedef çubuğu: en son tamamlanan deneme skorları. */
  recentScores: StudentRecentScores;
  /** Üniversite eşleşme rozeti: en iyi / güncel kabul skorları. */
  matchScores: StudentLatestScores;
  career: StudentCareerSnapshot;
  universityThresholds: UniversityThresholdProgress[];
}
