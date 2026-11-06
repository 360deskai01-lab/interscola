'use server';

import { getSessionUser } from '@/lib/auth';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import {
  fetchExamTestCentersForSchedule,
  fetchNearestOfficialExamSchedule,
} from '@/lib/exam-radar/repository';
import type { OfficialExamRadarData } from '@/types/exam-radar';

function normalizeCityHint(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}

const CITY_META_KEYS = [
  'city',
  'student_city',
  'home_city',
  'location_city',
] as const;

/**
 * Oturumdaki kullanıcının metadata alanından şehir ipucu (sınav merkezi önceliği).
 * Profilde ayrı şehir kolonu olmadığında geri dönüş sağlar.
 */
export async function readUserCityForRadar(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!admin) return null;

  try {
    const { data, error } = await admin.auth.admin.getUserById(user.id);
    if (error || !data.user) return null;
    const meta = data.user.user_metadata;
    if (!meta || typeof meta !== 'object') return null;
    const record = meta as Record<string, unknown>;
    for (const key of CITY_META_KEYS) {
      const v = record[key];
      if (typeof v === 'string') {
        const c = normalizeCityHint(v);
        if (c) return c;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function getOfficialExamRadarAction(
  userCity?: string | null,
): Promise<OfficialExamRadarData> {
  const session = await getSessionUser();
  const paramCity = normalizeCityHint(userCity ?? undefined);
  const resolvedCity = session ? paramCity ?? (await readUserCityForRadar()) : null;

  const nearest = await fetchNearestOfficialExamSchedule();

  if (!nearest?.id) {
    return { nearestExam: null, centers: [], userCity: resolvedCity };
  }

  const centers = await fetchExamTestCentersForSchedule(nearest.id, resolvedCity);

  return {
    nearestExam: nearest,
    centers,
    userCity: resolvedCity,
  };
}
