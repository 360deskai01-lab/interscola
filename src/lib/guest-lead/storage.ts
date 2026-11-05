import {
  GUEST_BUDGET_KEY,
  GUEST_LEAD_SCHEMA_VERSION,
  GUEST_SCHOLARSHIP_KEY,
} from '@/lib/guest-lead/constants';
import type {
  GuestBudgetLeadRecord,
  GuestScholarshipLeadRecord,
} from '@/lib/guest-lead/types';
import type { BudgetInput } from '@/lib/budget-simulator/types';
import type { ScholarshipSimulatorInput } from '@/lib/scholarship-simulator/types';
import type { ScholarshipSimulatorResult } from '@/lib/scholarship-simulator/types';

function parseJson<T>(raw: string | null): T | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeGuestScholarshipLead(
  input: ScholarshipSimulatorInput,
  result: ScholarshipSimulatorResult,
): void {
  if (typeof window === 'undefined') return;
  const record: GuestScholarshipLeadRecord = {
    v: GUEST_LEAD_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    input,
    needBasedScore: result.needBasedScore,
    meritBasedScore: result.meritBasedScore,
    summaryParagraph: result.summaryParagraph,
    matchIds: result.matches.map((m) => m.id),
  };
  window.localStorage.setItem(GUEST_SCHOLARSHIP_KEY, JSON.stringify(record));
}

export function readGuestScholarshipLead(): GuestScholarshipLeadRecord | null {
  if (typeof window === 'undefined') return null;
  const parsed = parseJson<GuestScholarshipLeadRecord>(
    window.localStorage.getItem(GUEST_SCHOLARSHIP_KEY),
  );
  if (!parsed || parsed.v !== GUEST_LEAD_SCHEMA_VERSION || !parsed.input) {
    return null;
  }
  return parsed;
}

export function clearGuestScholarshipLead(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GUEST_SCHOLARSHIP_KEY);
}

export function writeGuestBudgetLead(
  input: BudgetInput,
  result: {
    matchedCountriesCount: number;
    matchedCitiesCount: number;
    matchedUniversitiesCount: number;
    matchedUniversitiesSummary: string;
  },
): void {
  if (typeof window === 'undefined') return;
  const record: GuestBudgetLeadRecord = {
    v: GUEST_LEAD_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    input,
    matchedCountriesCount: result.matchedCountriesCount,
    matchedCitiesCount: result.matchedCitiesCount,
    matchedUniversitiesCount: result.matchedUniversitiesCount,
    matchedUniversitiesSummary: result.matchedUniversitiesSummary,
  };
  window.localStorage.setItem(GUEST_BUDGET_KEY, JSON.stringify(record));
}

export function readGuestBudgetLead(): GuestBudgetLeadRecord | null {
  if (typeof window === 'undefined') return null;
  const parsed = parseJson<GuestBudgetLeadRecord>(
    window.localStorage.getItem(GUEST_BUDGET_KEY),
  );
  if (!parsed || parsed.v !== GUEST_LEAD_SCHEMA_VERSION || !parsed.input) {
    return null;
  }
  return parsed;
}

export function clearGuestBudgetLead(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GUEST_BUDGET_KEY);
}
