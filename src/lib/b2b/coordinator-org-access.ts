import { STRICT_UUID_PATTERN } from '@/lib/uuid-patterns';

export type CoordinatorOrgAccessDecision =
  | { allowed: true; organizationId: string }
  | { allowed: false; code: 'no_membership' | 'foreign_organization' };

/**
 * Kurum koordinatörü vs platform admin için `organizationId` seçim sözleşmesi (DB yok).
 */
export function resolveCoordinatorOrganizationAccess(input: {
  isPlatformAdmin: boolean;
  membershipOrganizationId: string | null;
  requestedOrganizationId?: string | null;
}): CoordinatorOrgAccessDecision {
  const requested = input.requestedOrganizationId?.trim() ?? '';
  const hasValidRequest =
    requested.length > 0 && STRICT_UUID_PATTERN.test(requested);

  if (input.isPlatformAdmin && hasValidRequest) {
    return { allowed: true, organizationId: requested };
  }

  if (!input.membershipOrganizationId) {
    return { allowed: false, code: 'no_membership' };
  }

  if (
    hasValidRequest &&
    requested !== input.membershipOrganizationId
  ) {
    return { allowed: false, code: 'foreign_organization' };
  }

  return {
    allowed: true,
    organizationId: input.membershipOrganizationId,
  };
}
