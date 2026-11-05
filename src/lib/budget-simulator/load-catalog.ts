import { buildBudgetCatalog } from '@/lib/budget-simulator/catalog';
import type { BudgetCatalogEntry } from '@/lib/budget-simulator/types';
import {
  mapTargetUniversityRow,
  TARGET_UNIVERSITY_SELECT,
  TARGET_UNIVERSITY_SELECT_LEGACY,
} from '@/lib/universities/repository';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';

/** Sunucu: DB yayınlanmış üniversiteler + statik seed birleşimi. */
export async function loadBudgetCatalogEntries(): Promise<BudgetCatalogEntry[]> {
  const client = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!client) {
    return buildBudgetCatalog();
  }

  let { data, error } = await client
    .from('target_universities')
    .select(TARGET_UNIVERSITY_SELECT)
    .eq('status', 'published')
    .order('name', { ascending: true })
    .limit(200);

  if (error?.code === '42703') {
    const legacy = await client
      .from('target_universities')
      .select(TARGET_UNIVERSITY_SELECT_LEGACY)
      .order('name', { ascending: true })
      .limit(200);
    data = legacy.data as typeof data;
    error = legacy.error;
  }

  if (error || !data?.length) {
    return buildBudgetCatalog();
  }

  const universities = data.map((row) =>
    mapTargetUniversityRow(row as Parameters<typeof mapTargetUniversityRow>[0]),
  );
  return buildBudgetCatalog(universities);
}
