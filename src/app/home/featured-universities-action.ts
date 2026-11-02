'use server';

import {
  mapTargetUniversityRow,
  TARGET_UNIVERSITY_SELECT,
} from '@/lib/universities/repository';
import { formatSupabaseError } from '@/lib/universities/supabase-error';
import type { University } from '@/lib/universities/types';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';

/** Admin vitrin filtresi gelene kadar öncelikli slug adayları. */
const FEATURED_SLUG_PRIORITY: readonly string[] = [
  'bocconi-university',
  'technical-university-of-munich',
  'tum',
  'kings-college-london',
  'king-s-college-london',
  'politecnico-di-milano',
  'politecnico-milano',
];

const FEATURED_NAME_HINTS: readonly string[] = [
  'bocconi',
  'technical university of munich',
  'tum',
  "king's college",
  'kings college',
  'politecnico',
];

const HOME_FEATURED_LIMIT = 6;

function pickFeaturedUniversities(all: University[]): University[] {
  const picked: University[] = [];
  const seen = new Set<string>();

  const push = (u: University | undefined) => {
    if (!u || seen.has(u.id)) return;
    seen.add(u.id);
    picked.push(u);
  };

  for (const slug of FEATURED_SLUG_PRIORITY) {
    if (picked.length >= HOME_FEATURED_LIMIT) break;
    push(all.find((u) => u.slug === slug));
  }

  for (const hint of FEATURED_NAME_HINTS) {
    if (picked.length >= HOME_FEATURED_LIMIT) break;
    const lower = hint.toLowerCase();
    push(
      all.find(
        (u) =>
          u.name.toLowerCase().includes(lower) ||
          u.slug.toLowerCase().includes(lower.replace(/\s+/g, '-')),
      ),
    );
  }

  for (const u of all) {
    if (picked.length >= HOME_FEATURED_LIMIT) break;
    push(u);
  }

  return picked.slice(0, HOME_FEATURED_LIMIT);
}

export async function getFeaturedUniversitiesForHomeAction(): Promise<{
  success: boolean;
  universities: University[];
  error?: string;
}> {
  const client = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!client) {
    return {
      success: false,
      universities: [],
      error: 'Veritabanı bağlantısı kurulamadı.',
    };
  }

  const featuredResult = await client
    .from('target_universities')
    .select(`${TARGET_UNIVERSITY_SELECT}, is_featured, status`)
    .eq('is_featured', true)
    .eq('status', 'published')
    .order('name', { ascending: true })
    .limit(HOME_FEATURED_LIMIT);

  if (!featuredResult.error && (featuredResult.data?.length ?? 0) > 0) {
    return {
      success: true,
      universities: (featuredResult.data ?? []).map((row) =>
        mapTargetUniversityRow(
          row as Parameters<typeof mapTargetUniversityRow>[0],
        ),
      ),
    };
  }

  if (featuredResult.error && featuredResult.error.code !== '42703') {
    console.error(
      '[HOME_FEATURED_UNIVERSITIES_ERROR]:',
      formatSupabaseError(featuredResult.error),
    );
  }

  const { data, error } = await client
    .from('target_universities')
    .select(TARGET_UNIVERSITY_SELECT)
    .order('name', { ascending: true });

  if (error) {
    console.error(
      '[HOME_FEATURED_UNIVERSITIES_ERROR]:',
      formatSupabaseError(error),
    );
    return {
      success: false,
      universities: [],
      error: 'Vitrin üniversiteleri yüklenemedi.',
    };
  }

  const all = (data ?? []).map(mapTargetUniversityRow);

  return {
    success: true,
    universities: pickFeaturedUniversities(all),
  };
}
