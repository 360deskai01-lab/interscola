import type { StudentGoalsContext } from '@/lib/student-profile/types';
import type { StudentLatestScores, University } from '@/lib/universities/types';
import type { StudentRecentScores } from '@/lib/student-command-center/attempt-scores';

export interface StudentCommandCenterData {
  goals: StudentGoalsContext;
  pinnedUniversities: University[];
  /** Hedef çubuğu: en son tamamlanan deneme skorları. */
  recentScores: StudentRecentScores;
  /** Üniversite eşleşme rozeti: en iyi / güncel kabul skorları. */
  matchScores: StudentLatestScores;
}
