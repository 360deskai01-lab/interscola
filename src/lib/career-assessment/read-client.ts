import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Kariyer kayıtları okuma: öğretmen ↔ öğrenci RLS bypass için service role öncelikli.
 */
export async function getCareerAssessmentReadClient(): Promise<SupabaseClient | null> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}
