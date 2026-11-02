export type ExamAuditOriginType = 'self_practice' | 'assigned' | null;

export type ExamAuditSourceKind =
  | 'teacher_exam'
  | 'teacher_study'
  | 'free_diagnostic'
  | 'anonymous_pool'
  | 'unknown';

export interface ExamAuditEvaluations {
  feedback?: string;
  remedialTopics?: string[];
  metricBreakdown?: Record<string, number | string>;
}

export interface GlobalExamAuditLogRow {
  id: string;
  examTitle: string;
  curriculum: string;
  engineType: string | null;
  rawScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  scaledResult: string | null;
  originType: ExamAuditOriginType;
  assignmentId: string | null;
  assignmentType: string | null;
  sourceKind: ExamAuditSourceKind;
  studentId: string | null;
  studentFullName: string | null;
  studentEmail: string | null;
  createdAt: string;
  evaluations: ExamAuditEvaluations | null;
  metricBreakdown: Record<string, number | string> | null;
}

export interface GlobalExamAuditMetrics {
  totalAttempts: number;
  todayAttempts: number;
  averageSatScore: number | null;
  averageIeltsBand: number | null;
}

export interface GlobalExamAuditResult {
  rows: GlobalExamAuditLogRow[];
  total: number;
  page: number;
  limit: number;
  metrics: GlobalExamAuditMetrics;
}
