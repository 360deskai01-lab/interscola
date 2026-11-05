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
}

export interface CoordinatorMemberSummary {
  id: string;
  userId: string;
  orgRole: string;
  branchId: string | null;
  branchName: string | null;
  displayName: string;
  email: string | null;
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
}
