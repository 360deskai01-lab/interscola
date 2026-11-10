import type { CoordinatorA4CaieAoSummary } from '@/lib/b2b/coordinator-a4-caie-ao';
import type { WeaknessTopicCount } from '@/lib/b2b/weakness-ledger-topics';

export type CoordinatorSchoolReportFacultyRow = {
  displayName: string;
  email: string | null;
  branchName: string | null;
  linkedStudentCount: number;
  avgSatScore: number | null;
  avgIeltsBand: number | null;
};

export type CoordinatorSchoolReportData = {
  organizationId: string;
  organizationName: string;
  emblemLabel: string;
  reportIssuedAtIso: string;
  coordinatorName: string;
  verificationCode: string;
  licenseType: string | null;
  joinCode: string | null;
  license: {
    studentQuota: number | null;
    studentsUsed: number;
    studentUsagePercent: number | null;
    teacherQuota: number;
    teachersUsed: number;
    teacherUsagePercent: number;
  };
  academic: {
    totalCompletedAttempts: number;
    avgSatScore: number | null;
    avgIeltsBand: number | null;
    caieSuccessPercent: number | null;
    completionRatePercent: number | null;
  };
  faculty: CoordinatorSchoolReportFacultyRow[];
  criticalWeaknesses: WeaknessTopicCount[];
  branchCount: number;
  /** Cambridge A-Level / CAIE kurumsal AO özeti (deneme yoksa showBlock: false). */
  caieAo: CoordinatorA4CaieAoSummary;
};
