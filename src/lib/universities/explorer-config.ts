/** DB `tuition_tier` enum sözleşmesi. */
export const TUITION_TIERS = [
  'FREE_SYMBOLIC',
  'AFFORDABLE',
  'MODERATE',
  'PREMIUM',
] as const;

export type TuitionTier = (typeof TUITION_TIERS)[number];

export const TUITION_TIER_ORDER: Record<TuitionTier, number> = {
  FREE_SYMBOLIC: 0,
  AFFORDABLE: 1,
  MODERATE: 2,
  PREMIUM: 3,
};

export const TUITION_TIER_OPTIONS: {
  id: TuitionTier;
  label: string;
  hint: string;
}[] = [
  {
    id: 'FREE_SYMBOLIC',
    label: '< 1.000 €',
    hint: 'Sembolik / ücretsiz (Almanya, DSU vb.)',
  },
  {
    id: 'AFFORDABLE',
    label: '1.000 € – 5.000 €',
    hint: 'Ekonomik (İtalya vb.)',
  },
  {
    id: 'MODERATE',
    label: '5.000 € – 12.000 €',
    hint: 'Orta segment',
  },
  {
    id: 'PREMIUM',
    label: '12.000 €+',
    hint: 'Özel / yüksek harç',
  },
];

export const UNIVERSITY_DISCIPLINE_TAGS = [
  'engineering',
  'data_tech',
  'business_economics',
  'health_medicine',
  'law_social',
  'architecture_design',
] as const;

export type UniversityDisciplineTag = (typeof UNIVERSITY_DISCIPLINE_TAGS)[number];

export const DISCIPLINE_GROUPS: {
  id: string;
  label: string;
  emoji: string;
  tags: readonly UniversityDisciplineTag[];
}[] = [
  {
    id: 'engineering_tech',
    label: 'Mühendislik & Teknoloji',
    emoji: '⚙️',
    tags: ['engineering', 'data_tech'],
  },
  {
    id: 'business_economics',
    label: 'İşletme, Ekonomi & Finans',
    emoji: '💼',
    tags: ['business_economics'],
  },
  {
    id: 'health_medicine',
    label: 'Tıp & Sağlık',
    emoji: '🧬',
    tags: ['health_medicine'],
  },
  {
    id: 'law_social',
    label: 'Hukuk & Sosyal Bilimler',
    emoji: '🏛️',
    tags: ['law_social'],
  },
  {
    id: 'architecture_design',
    label: 'Mimarlık & Tasarım',
    emoji: '🎨',
    tags: ['architecture_design'],
  },
];

export type UniversityExamFilter = 'SAT' | 'IELTS' | 'ALEVEL';

export type UniversitySortBy = 'popular' | 'sat_asc' | 'tuition_asc';

export const DEFAULT_UNIVERSITY_PAGE_SIZE = 12;

export const EXPLORER_COUNTRY_OPTIONS = [
  'ALL',
  'İtalya',
  'Hollanda',
  'Almanya',
  'İngiltere',
  'ABD',
] as const;

export type ExplorerCountryFilter = (typeof EXPLORER_COUNTRY_OPTIONS)[number];

export function isTuitionTier(value: string): value is TuitionTier {
  return (TUITION_TIERS as readonly string[]).includes(value);
}

export function resolveDisciplineTags(
  discipline?: string,
): UniversityDisciplineTag[] | null {
  const raw = discipline?.trim();
  if (!raw) return null;

  const group = DISCIPLINE_GROUPS.find((g) => g.id === raw);
  if (group) return [...group.tags];

  if ((UNIVERSITY_DISCIPLINE_TAGS as readonly string[]).includes(raw)) {
    return [raw as UniversityDisciplineTag];
  }

  return null;
}

export function parseExplorerCountry(
  raw: string | undefined,
): ExplorerCountryFilter {
  if (!raw?.trim()) return 'ALL';
  const value = raw.trim() as ExplorerCountryFilter;
  return (EXPLORER_COUNTRY_OPTIONS as readonly string[]).includes(value)
    ? value
    : 'ALL';
}

export function parseExamFilter(
  raw: string | undefined,
): UniversityExamFilter | undefined {
  if (raw === 'SAT' || raw === 'IELTS' || raw === 'ALEVEL') return raw;
  return undefined;
}

export function parseSortBy(raw: string | undefined): UniversitySortBy {
  if (raw === 'sat_asc' || raw === 'tuition_asc') return raw;
  return 'popular';
}

export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
