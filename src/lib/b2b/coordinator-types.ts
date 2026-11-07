export const COORDINATOR_ELIGIBLE_ORG_ROLES = [
  'coordinator',
  'org_admin',
  'school_admin',
] as const;

export type CoordinatorEligibleOrgRole =
  (typeof COORDINATOR_ELIGIBLE_ORG_ROLES)[number];

export function isCoordinatorEligibleOrgRole(
  role: string | null | undefined,
): role is CoordinatorEligibleOrgRole {
  if (!role) return false;
  return (COORDINATOR_ELIGIBLE_ORG_ROLES as readonly string[]).includes(role);
}

export interface CoordinatorBranchSummary {
  id: string;
  name: string;
  city: string | null;
  activeTeacherCount: number;
  activeStudentCount: number;
}

/** Kurumsal başarı radarı — tamamlanmış deneme özetleri. */
export interface CoordinatorOrgPerformanceMetrics {
  avgSatScore: number | null;
  maxSatScore: number | null;
  avgIeltsBand: number | null;
  totalCompletedAttempts: number;
}

export interface CoordinatorMemberSummary {
  id: string;
  userId: string;
  orgRole: string;
  branchId: string | null;
  branchName: string | null;
  displayName: string;
  email: string | null;
  /** `organization_members.created_at` (ISO). */
  memberCreatedAt: string | null;
  /** Öğrenci profilindeki hedef sınav etiketleri (ör. SAT, IELTS). */
  targetExamLabels: string[];
  /** Son tamamlanan deneme özeti (yoksa null). */
  lastAttemptDisplay: string | null;
}

export interface CoordinatorOrganizationSummary {
  id: string;
  name: string;
  licenseType: string | null;
  studentQuota: number | null;
  validUntil: string | null;
  isActive: boolean;
  joinCode: string | null;
  seatsUsed: number;
  seatsRemaining: number | null;
  usagePercent: number | null;
  isQuotaFull: boolean;
}

export interface CoordinatorOrganizationContext {
  membershipId: string;
  orgRole: CoordinatorEligibleOrgRole;
  organization: CoordinatorOrganizationSummary;
  branches: CoordinatorBranchSummary[];
  teachers: CoordinatorMemberSummary[];
  students: CoordinatorMemberSummary[];
  orgPerformance: CoordinatorOrgPerformanceMetrics;
}

/** Koordinatör akademik çekmece — tamamlanmış deneme satırı. */
export interface CoordinatorStudentAttemptDetail {
  id: string;
  examTitle: string;
  curriculum: string;
  createdAt: string;
  scaledResult: string;
  rawScore: number | null;
  maxScore: number | null;
  scoreLabel: string;
}

/** `getCoordinatorStudentDetailAction` çıktısı. */
export interface CoordinatorStudentDetail {
  userId: string;
  displayName: string;
  email: string | null;
  branchId: string | null;
  branchName: string | null;
  targetExamLabels: string[];
  targetScores: Record<string, number | string>;
  bestSatScore: number | null;
  bestIeltsBand: number | null;
  attempts: CoordinatorStudentAttemptDetail[];
}
