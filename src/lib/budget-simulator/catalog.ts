import { BUDGET_CATALOG_SEED } from '@/lib/budget-simulator/catalog-seed';
import {
  annualTuitionFromTier,
  countryFlagEmoji,
  isTuitionTier,
  parseAnnualTuitionEur,
  parseEuroAmount,
} from '@/lib/budget-simulator/parse-costs';
import type { BudgetCatalogEntry } from '@/lib/budget-simulator/types';
import { enrichUniversityCatalogEntry } from '@/lib/budget-simulator/university-enrichment';
import type { University } from '@/lib/universities/types';

function entryFromUniversity(row: University): BudgetCatalogEntry | null {
  const city = row.city?.trim();
  if (!city || !row.name?.trim() || !row.country?.trim()) return null;

  const living = parseEuroAmount(row.monthly_living_cost);
  if (living === null) return null;

  const tierRaw = row.tuition_tier ?? null;
  const tier = isTuitionTier(tierRaw) ? tierRaw : 'MODERATE';
  const annual = parseAnnualTuitionEur(row.tuition_fee_range, tier);

  return {
    slug: row.slug?.trim() || row.id,
    name: row.name.trim(),
    country: row.country.trim(),
    city,
    monthlyLivingEur: living,
    annualTuitionEur: annual,
    tuitionTier: tier,
    minSat: row.min_sat_score ?? null,
    minIelts: row.min_ielts_band ?? null,
    minAlevel: row.min_alevel ?? null,
    flagEmoji: countryFlagEmoji(row.country),
  };
}

/** DB satırları seed ile birleşir; aynı slug DB kaydı seed’i geçersiz kılar. */
export function buildBudgetCatalog(fromDb: University[] = []): BudgetCatalogEntry[] {
  const bySlug = new Map<string, BudgetCatalogEntry>();

  for (const seed of BUDGET_CATALOG_SEED) {
    bySlug.set(seed.slug, seed);
  }

  for (const row of fromDb) {
    const parsed = entryFromUniversity(row);
    if (!parsed) continue;
    const key = parsed.slug || row.id;
    bySlug.set(key, parsed);
  }

  return [...bySlug.values()].map(enrichUniversityCatalogEntry);
}

/** Yalnızca tier bilgisi eksik satır için yedek. */
export function fallbackAnnualForEntry(entry: BudgetCatalogEntry): number {
  if (entry.annualTuitionEur > 0) return entry.annualTuitionEur;
  return annualTuitionFromTier(entry.tuitionTier);
}
