import type { TuitionTier } from '@/lib/universities/explorer-config';

const SHORT_LABELS: Record<TuitionTier, string> = {
  FREE_SYMBOLIC: 'Sembolik / ücretsiz',
  AFFORDABLE: 'Ekonomik harç',
  MODERATE: 'Orta segment',
  PREMIUM: 'Premium harç',
};

export function tuitionTierShortLabel(
  tier: string | null | undefined,
): string | null {
  if (!tier) return null;
  if (tier in SHORT_LABELS) {
    return SHORT_LABELS[tier as TuitionTier];
  }
  return tier;
}
