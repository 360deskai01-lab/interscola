import type { CoordinatorOrganizationContext } from '@/lib/b2b/coordinator-types';
import { COORDINATOR_ELIGIBLE_ORG_ROLES } from '@/lib/b2b/coordinator-types';

export type ApprovedCoordinatorSession = {
  userId: string;
  email: string | null;
  fullName: string;
  isPlatformAdmin: boolean;
  orgRole: (typeof COORDINATOR_ELIGIBLE_ORG_ROLES)[number] | 'admin' | null;
};

export type CoordinatorTeacherWorkloadRow = {
  memberId: string;
  userId: string;
  displayName: string;
  email: string | null;
  branchName: string | null;
  specialtyLabel: string;
  linkedStudentCount: number;
};

export type CoordinatorDashboardLicenseSnapshot = {
  studentQuota: number | null;
  studentsActive: number;
  seatsRemaining: number | null;
  usagePercent: number | null;
  isQuotaFull: boolean;
  teachersUsed: number;
  teacherQuota: number;
  teachersRemaining: number;
  teacherUsagePercent: number;
  isTeacherQuotaFull: boolean;
};

export type CoordinatorAdminOrganizationOption = {
  id: string;
  name: string;
};

export type CoordinatorDashboardData = {
  context: CoordinatorOrganizationContext;
  license: CoordinatorDashboardLicenseSnapshot;
  joinCode: string | null;
  teachersWithLoad: CoordinatorTeacherWorkloadRow[];
  /** Platform admin kurum seçici — standart koordinatörde boş. */
  adminOrganizationOptions: CoordinatorAdminOrganizationOption[];
  selectedOrganizationId: string;
};
