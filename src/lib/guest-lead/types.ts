import type { BudgetInput } from '@/lib/budget-simulator/types';
import type { ScholarshipSimulatorInput } from '@/lib/scholarship-simulator/types';

import type { GUEST_LEAD_SCHEMA_VERSION } from '@/lib/guest-lead/constants';

export type GuestScholarshipLeadRecord = {
  v: typeof GUEST_LEAD_SCHEMA_VERSION;
  savedAt: string;
  input: ScholarshipSimulatorInput;
  needBasedScore: number;
  meritBasedScore: number;
  summaryParagraph: string;
  matchIds: string[];
};

export type GuestBudgetLeadRecord = {
  v: typeof GUEST_LEAD_SCHEMA_VERSION;
  savedAt: string;
  input: BudgetInput;
  matchedCountriesCount: number;
  matchedCitiesCount: number;
  matchedUniversitiesCount: number;
  matchedUniversitiesSummary: string;
};

export type GuestLeadClaimPayload = {
  scholarship?: GuestScholarshipLeadRecord;
  budget?: GuestBudgetLeadRecord;
};
