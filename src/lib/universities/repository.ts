import type { University } from '@/lib/universities/types';
import { formatSupabaseError } from '@/lib/universities/supabase-error';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabasePublicAnon } from '@/lib/supabase/public-anon';

/**
 * `public.target_universities` — kolon adları DB ile birebir (min_sat_score / min_ielts_band).
 */
export const TARGET_UNIVERSITY_SELECT =
  'id, slug, name, country, city, min_sat_score, min_ielts_band, min_alevel, min_gpa, tuition_fee_range, monthly_living_cost, accommodation_info, application_deadlines, description, scholarship_info, local_exam_requirements, website_url, logo_url, cover_image_url';

type TargetUniversityRow = {
  id: string;
  slug: string | null;
  name: string;
  country: string;
  city: string | null;
  min_sat_score: number | null;
  min_ielts_band: number | string | null;
  min_alevel: string | null;
  min_gpa: string | null;
  tuition_fee_range: string | null;
  monthly_living_cost: string | null;
  accommodation_info: string | null;
  application_deadlines: string | null;
  description: string | null;
  scholarship_info: string | null;
  local_exam_requirements: string | null;
  website_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
};

export function mapTargetUniversityRow(row: TargetUniversityRow): University {
  const bandRaw = row.min_ielts_band;
  const min_ielts_band =
    bandRaw === null || bandRaw === undefined
      ? null
      : typeof bandRaw === 'number'
        ? bandRaw
        : Number.parseFloat(String(bandRaw));

  return {
    id: row.id,
    slug: row.slug?.trim() ?? '',
    name: row.name,
    country: row.country,
    city: row.city ?? null,
    min_sat_score: row.min_sat_score ?? null,
    min_ielts_band: Number.isFinite(min_ielts_band) ? min_ielts_band : null,
    min_alevel: row.min_alevel?.trim() || null,
    min_gpa: row.min_gpa?.trim() || null,
    tuition_fee_range: row.tuition_fee_range ?? null,
    monthly_living_cost: row.monthly_living_cost ?? null,
    accommodation_info: row.accommodation_info ?? null,
    application_deadlines: row.application_deadlines ?? null,
    description: row.description ?? null,
    scholarship_info: row.scholarship_info ?? null,
    local_exam_requirements: row.local_exam_requirements ?? null,
    website_url: row.website_url ?? null,
    logo_url: row.logo_url?.trim() || null,
    cover_image_url: row.cover_image_url?.trim() || null,
  };
}

/** Service role (build/Vercel) veya çerezsiz anon — `"use cache"` ile uyumlu. */
function getTargetUniversitiesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return getSupabasePublicAnon(PROFILES_SCHEMA);
}

export async function fetchTargetUniversityBySlug(
  slug: string,
): Promise<University | null> {
  const normalized = slug.trim();
  if (!normalized) return null;

  const client = getTargetUniversitiesClient();
  if (!client) return null;

  const { data, error } = await client
    .from('target_universities')
    .select(TARGET_UNIVERSITY_SELECT)
    .eq('slug', normalized)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error(
        '[UNIVERSITY_BY_SLUG_ERROR]:',
        formatSupabaseError(error),
        { slug: normalized, select: TARGET_UNIVERSITY_SELECT },
      );
    }
    return null;
  }

  return mapTargetUniversityRow(data as TargetUniversityRow);
}
