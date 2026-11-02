import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { universityPagePath } from '@/lib/universities/seo-copy';

export interface TargetUniversitySeoEntry {
  slug: string;
  lastModified: Date;
}

function resolveSupabaseUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  );
}

/**
 * Build / sitemap için `target_universities` slug listesi (boş slug'lar elenir).
 */
export async function listTargetUniversitySeoEntries(): Promise<
  TargetUniversitySeoEntry[]
> {
  const url = resolveSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    console.warn(
      '[universities-seo] Supabase yapılandırması eksik; slug listesi boş dönecek.',
    );
    return [];
  }

  if (!process.env.SUPABASE_URL?.trim()) {
    process.env.SUPABASE_URL = url;
  }

  const client = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from('target_universities')
    .select('slug, created_at')
    .order('name', { ascending: true });

  if (error) {
    console.error('[universities-seo] slug listesi okunamadı:', error.message);
    return [];
  }

  const fallbackModified = new Date();

  return (data ?? [])
    .map((row) => {
      const slug =
        typeof (row as { slug?: string }).slug === 'string'
          ? (row as { slug: string }).slug.trim()
          : '';
      if (!slug) return null;

      const createdRaw = (row as { created_at?: string | null }).created_at;
      const lastModified =
        createdRaw && !Number.isNaN(Date.parse(createdRaw))
          ? new Date(createdRaw)
          : fallbackModified;

      return { slug, lastModified };
    })
    .filter((entry): entry is TargetUniversitySeoEntry => entry !== null);
}

export function universitySitemapPath(slug: string): string {
  return universityPagePath(slug);
}

/**
 * `cacheComponents` build doğrulaması en az bir slug ister; DB erişilemezse
 * `UNIVERSITY_SSG_VALIDATION_SLUG` (varsayılan: bocconi-university) kullanılır.
 */
export async function listStaticUniversitySlugParams(): Promise<{ slug: string }[]> {
  const entries = await listTargetUniversitySeoEntries();
  if (entries.length > 0) {
    return entries.map(({ slug }) => ({ slug }));
  }

  const fallbackSlug =
    process.env.UNIVERSITY_SSG_VALIDATION_SLUG?.trim() || 'bocconi-university';
  console.warn(
    `[universities-seo] SSG slug listesi boş; build doğrulaması için "${fallbackSlug}" kullanılıyor.`,
  );
  return [{ slug: fallbackSlug }];
}
