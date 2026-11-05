import type { TuitionTier } from '@/lib/universities/explorer-config';
import { TUITION_TIER_ORDER } from '@/lib/universities/explorer-config';

/** Metin alanlarından (ör. "850 €/ay", "1.200") tek EUR tahmini çıkarır. */
export function parseEuroAmount(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const normalized = raw.replace(/\s/g, '').replace(/€|EUR|eur/gi, '');
  const match = normalized.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/);
  if (!match?.[1]) return null;
  let token = match[1];
  if (/^\d{1,3}(?:\.\d{3})+$/.test(token)) {
    token = token.replace(/\./g, '');
  } else {
    token = token.replace(',', '.');
  }
  const value = Number.parseFloat(token);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Yıllık harç bandı — tier yedek değerleri ile. */
export function annualTuitionFromTier(tier: TuitionTier | string | null | undefined): number {
  switch (tier) {
    case 'FREE_SYMBOLIC':
      return 350;
    case 'AFFORDABLE':
      return 2800;
    case 'MODERATE':
      return 8500;
    case 'PREMIUM':
      return 16000;
    default:
      return 4500;
  }
}

export function parseAnnualTuitionEur(
  tuitionRange: string | null | undefined,
  tier: TuitionTier | string | null | undefined,
): number {
  const fromRange = parseEuroAmount(tuitionRange ?? null);
  if (fromRange !== null && fromRange > 0) {
    if (fromRange <= 400) return fromRange;
    return fromRange;
  }
  return annualTuitionFromTier(tier);
}

export function isTuitionTier(value: string | null | undefined): value is TuitionTier {
  if (!value) return false;
  return value in TUITION_TIER_ORDER;
}

export function countryFlagEmoji(country: string): string {
  const key = country.trim().toLowerCase();
  const map: Record<string, string> = {
    almanya: '🇩🇪',
    germany: '🇩🇪',
    i̇talya: '🇮🇹',
    italya: '🇮🇹',
    italy: '🇮🇹',
    hollanda: '🇳🇱',
    netherlands: '🇳🇱',
    i̇ngiltere: '🇬🇧',
    ingiltere: '🇬🇧',
    'birleşik krallık': '🇬🇧',
    uk: '🇬🇧',
    fransa: '🇫🇷',
    france: '🇫🇷',
    i̇spanya: '🇪🇸',
    ispanya: '🇪🇸',
    spain: '🇪🇸',
    avusturya: '🇦🇹',
    austria: '🇦🇹',
    polonya: '🇵🇱',
    poland: '🇵🇱',
    i̇sveç: '🇸🇪',
    isvec: '🇸🇪',
    sweden: '🇸🇪',
    belçika: '🇧🇪',
    belcika: '🇧🇪',
    belgium: '🇧🇪',
  };
  return map[key] ?? '🌍';
}
