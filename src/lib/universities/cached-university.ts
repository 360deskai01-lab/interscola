'use cache';

import { cacheLife } from 'next/cache';
import { fetchTargetUniversityBySlug } from '@/lib/universities/repository';

/** Üniversite detay içeriği — günde bir kez arka planda yenilenir (86400 sn). */
export async function fetchTargetUniversityBySlugCached(slug: string) {
  cacheLife({ stale: 300, revalidate: 86400, expire: 604800 });
  return fetchTargetUniversityBySlug(slug);
}
