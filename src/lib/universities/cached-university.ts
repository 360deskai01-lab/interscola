'use cache';

import { cacheLife } from 'next/cache';
import { fetchTargetUniversityBySlug } from '@/lib/universities/repository';

/**
 * Üniversite detay içeriği — günde bir kez arka planda yenilenir (86400 sn).
 * Yalnızca slug argümanı kullanılır; cookies/headers/oturum bu katmanda yok.
 */
export async function fetchTargetUniversityBySlugCached(slug: string) {
  cacheLife({ stale: 300, revalidate: 86400, expire: 604800 });
  const normalized = slug.trim();
  if (!normalized) return null;
  return fetchTargetUniversityBySlug(normalized);
}
