import { buildBudgetCatalog, fallbackAnnualForEntry } from '@/lib/budget-simulator/catalog';
import { BUDGET_CATALOG_SEED } from '@/lib/budget-simulator/catalog-seed';
import { BUDGET_PART_TIME_TIP_PILL } from '@/lib/budget-simulator/university-enrichment';
import type {
  BudgetCatalogEntry,
  BudgetInput,
  BudgetMatchResult,
  PreferredAccommodation,
  TuitionTolerance,
} from '@/lib/budget-simulator/types';
import {
  BUDGET_MONTHLY_MAX,
  BUDGET_MONTHLY_MIN,
} from '@/lib/budget-simulator/types';
import type { TuitionTier } from '@/lib/universities/explorer-config';
import type { University } from '@/lib/universities/types';

function clampBudget(value: number): number {
  return Math.min(BUDGET_MONTHLY_MAX, Math.max(BUDGET_MONTHLY_MIN, value));
}

function accommodationMultiplier(mode: PreferredAccommodation): number {
  switch (mode) {
    case 'DORM':
      return 0.92;
    case 'SHARED':
      return 1;
    case 'STUDIO':
      return 1.18;
  }
}

function passesTuitionTolerance(
  tier: TuitionTier,
  annualTuitionEur: number,
  tolerance: TuitionTolerance,
): boolean {
  switch (tolerance) {
    case 'ANY':
      return true;
    case 'LOW':
      return (
        tier === 'FREE_SYMBOLIC' ||
        tier === 'AFFORDABLE' ||
        annualTuitionEur < 4000
      );
    case 'FREE_ONLY':
      return tier === 'FREE_SYMBOLIC' || annualTuitionEur <= 1000;
  }
}

function estimatedMonthlyTotal(
  entry: BudgetCatalogEntry,
  accommodation: PreferredAccommodation,
): number {
  const living = entry.monthlyLivingEur * accommodationMultiplier(accommodation);
  const annual = fallbackAnnualForEntry(entry);
  return Math.round(living + annual / 10);
}

export function evaluateBudgetSimulator(
  input: BudgetInput,
  catalog: BudgetCatalogEntry[] = buildBudgetCatalog(),
): BudgetMatchResult {
  const monthlyBudget = clampBudget(input.monthlyBudget);
  const matched = catalog.filter((entry) => {
    if (
      !passesTuitionTolerance(
        entry.tuitionTier,
        entry.annualTuitionEur,
        input.tuitionTolerance,
      )
    ) {
      return false;
    }
    const total = estimatedMonthlyTotal(entry, input.preferredAccommodation);
    return total <= monthlyBudget;
  });

  const countries = new Set(matched.map((m) => m.country));
  const cityKeys = new Set(
    matched.map((m) => `${m.country}::${m.city}`.toLowerCase()),
  );

  const cityMinMap = new Map<
    string,
    { entry: BudgetCatalogEntry; total: number }
  >();
  for (const entry of matched) {
    const key = `${entry.country}::${entry.city}`.toLowerCase();
    const total = estimatedMonthlyTotal(entry, input.preferredAccommodation);
    const prev = cityMinMap.get(key);
    if (!prev || total < prev.total) {
      cityMinMap.set(key, { entry, total });
    }
  }

  const sampleCities = [...cityMinMap.values()]
    .sort((a, b) => a.total - b.total)
    .slice(0, 2)
    .map(({ entry, total }) => ({
      city: entry.city,
      country: entry.country,
      flagEmoji: entry.flagEmoji,
      minMonthlyTotalEur: total,
      exampleUniversity: entry.name,
      partTimeWork: entry.partTimeWork,
      specialProgram: entry.specialProgram,
    }));

  const summary =
    matched.length === 0
      ? `Aylık €${monthlyBudget} bütçe ve seçtiğiniz harç filtresiyle eşleşen üniversite bulunamadı. Bütçeyi artırmayı veya harç toleransını genişletmeyi deneyin.`
      : `€${monthlyBudget}/ay bütçeniz (yaşam + harç/10 modeli) ${countries.size} ülkede, ${cityKeys.size} şehirde toplam ${matched.length} üniversite programını karşılıyor.`;

  const lockedUniversities = [...matched]
    .sort(
      (a, b) =>
        estimatedMonthlyTotal(a, input.preferredAccommodation) -
        estimatedMonthlyTotal(b, input.preferredAccommodation),
    )
    .map((entry) => ({
      name: entry.name,
      city: entry.city,
      country: entry.country,
      estimatedMonthlyTotalEur: estimatedMonthlyTotal(
        entry,
        input.preferredAccommodation,
      ),
      minSat: entry.minSat,
      minIelts: entry.minIelts,
      minAlevel: entry.minAlevel,
    }));

  const accommodationTips = accommodationTipsFor(input.preferredAccommodation);

  return {
    matchedCitiesCount: cityKeys.size,
    matchedUniversitiesCount: matched.length,
    matchedCountriesCount: countries.size,
    sampleCities,
    matchedUniversitiesSummary: summary,
    lockedUniversities,
    accommodationTips,
    partTimeInsightPill: BUDGET_PART_TIME_TIP_PILL,
  };
}

function accommodationTipsFor(mode: PreferredAccommodation): string[] {
  const common = [
    'DSU / ER.GO başvurularında konaklama maliyetini resmi formda beyan edin.',
    'Kira sözleşmesi ve depozito, ilk ay bütçesini %15–20 artırabilir — simülasyona pay bırakın.',
  ];
  switch (mode) {
    case 'DORM':
      return [
        'Öğrenci yurdu (DSU / ER.GO / Studierendenwerk): genelde en düşük aylık gider.',
        'Yurt başvurusu kabul mektubundan hemen sonra; kontenjanlar hızla dolar.',
        ...common,
      ];
    case 'SHARED':
      return [
        'WG (paylaşımlı daire): Uniplaces, HousingAnywhere ve yerel Facebook grupları.',
        'Depozito + komisyon için 2–3 aylık gideri rezervde tutun.',
        ...common,
      ];
    case 'STUDIO':
      return [
        'Stüdyo / tek kişilik daire: şehir merkezinde +%15–25 yaşam maliyeti.',
        'Apostilli gelir belgesi kira sözleşmesinde sık istenir.',
        ...common,
      ];
  }
}

/** Audit: seed katalog üzerinde deterministik senaryo. */
export const AUDIT_BUDGET_COMFORT_INPUT: BudgetInput = {
  monthlyBudget: 1200,
  tuitionTolerance: 'ANY',
  preferredAccommodation: 'SHARED',
};

export const AUDIT_BUDGET_TIGHT_INPUT: BudgetInput = {
  monthlyBudget: 900,
  tuitionTolerance: 'LOW',
  preferredAccommodation: 'DORM',
};

export function auditBudgetCatalogSize(): number {
  return BUDGET_CATALOG_SEED.length;
}

export function evaluateBudgetFromDbRows(
  input: BudgetInput,
  rows: University[],
): BudgetMatchResult {
  return evaluateBudgetSimulator(input, buildBudgetCatalog(rows));
}
