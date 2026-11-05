import { GUEST_LEAD_TARGET_SCORES_KEY } from '@/lib/guest-lead/constants';
import type {
  GuestBudgetLeadRecord,
  GuestScholarshipLeadRecord,
} from '@/lib/guest-lead/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mergeGuestLeadIntoTargetScores(
  existingTargetScores: unknown,
  patch: {
    scholarship?: GuestScholarshipLeadRecord;
    budget?: GuestBudgetLeadRecord;
  },
): Record<string, unknown> {
  const base = isRecord(existingTargetScores)
    ? { ...existingTargetScores }
    : {};

  const prevLead = isRecord(base[GUEST_LEAD_TARGET_SCORES_KEY])
    ? { ...(base[GUEST_LEAD_TARGET_SCORES_KEY] as Record<string, unknown>) }
    : {};

  if (patch.scholarship) {
    prevLead.scholarship = patch.scholarship;
  }
  if (patch.budget) {
    prevLead.budget = patch.budget;
  }
  prevLead.claimedAt = new Date().toISOString();

  base[GUEST_LEAD_TARGET_SCORES_KEY] = prevLead;
  return base;
}
