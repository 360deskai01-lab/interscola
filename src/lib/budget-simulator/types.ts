import type { TuitionTier } from '@/lib/universities/explorer-config';

export type TuitionTolerance = 'ANY' | 'LOW' | 'FREE_ONLY';

export type PreferredAccommodation = 'DORM' | 'SHARED' | 'STUDIO';

export interface BudgetInput {
  /** €500 – €3.500 (UI kaydırıcı genelde 600–3.000). */
  monthlyBudget: number;
  tuitionTolerance: TuitionTolerance;
  preferredAccommodation: PreferredAccommodation;
}

export interface BudgetSampleCity {
  city: string;
  country: string;
  flagEmoji: string;
  minMonthlyTotalEur: number;
  exampleUniversity: string;
  partTimeWork?: string;
  specialProgram?: string;
}

export interface BudgetLockedUniversityRow {
  name: string;
  city: string;
  country: string;
  estimatedMonthlyTotalEur: number;
  minSat: number | null;
  minIelts: number | null;
  minAlevel: string | null;
}

export interface BudgetMatchResult {
  matchedCitiesCount: number;
  matchedUniversitiesCount: number;
  matchedCountriesCount: number;
  sampleCities: BudgetSampleCity[];
  matchedUniversitiesSummary: string;
  lockedUniversities: BudgetLockedUniversityRow[];
  accommodationTips: string[];
  /** Açık karne altı part-time bilgilendirme hapı metni. */
  partTimeInsightPill?: string;
}

/** Bütçe kataloğu satırı (`UniversityCatalogEntry` ile aynı sözleşme). */
export interface BudgetCatalogEntry {
  slug: string;
  name: string;
  country: string;
  city: string;
  monthlyLivingEur: number;
  annualTuitionEur: number;
  tuitionTier: TuitionTier;
  minSat: number | null;
  minIelts: number | null;
  minAlevel: string | null;
  flagEmoji: string;
  partTimeWork?: string;
  specialProgram?: string;
}

export type UniversityCatalogEntry = BudgetCatalogEntry;

export const BUDGET_SIMULATOR_PATH = '/test-et/budget';

export const BUDGET_REGISTER_HREF = '/auth/register?source=budget';

export const BUDGET_MONTHLY_MIN = 500;
export const BUDGET_MONTHLY_MAX = 3500;
