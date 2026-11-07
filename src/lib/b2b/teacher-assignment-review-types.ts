export interface TeacherAssignmentReviewDetail {
  assignmentId: string;
  materialTitle: string;
  studentFullName: string;
  curriculum: string;
  assignmentType: 'exam' | 'study';
  status: string;
  isCompleted: boolean;
  scaledResult: string | null;
  rawScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  completedAt: string | null;
  /** Oturum süresi veya planlanan süre özeti (yoksa null). */
  durationLabel: string | null;
  weaknessTopics: string[];
}
