import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DEFAULT_UNIVERSITY_PAGE_SIZE,
  resolveDisciplineTags,
  TUITION_TIER_ORDER,
  type TuitionTier,
  type UniversityExamFilter,
  type UniversitySortBy,
} from '@/lib/universities/explorer-config';
import {
  mapTargetUniversityRow,
  TARGET_UNIVERSITY_SELECT,
  TARGET_UNIVERSITY_SELECT_LEGACY,
} from '@/lib/universities/repository';
import type { University } from '@/lib/universities/types';

export interface UniversityListFilters {
  country?: string;
  discipline?: string;
  tuitionTier?: TuitionTier;
  examType?: UniversityExamFilter;
  search?: string;
  sortBy?: UniversitySortBy;
  page?: number;
  pageSize?: number;
}

export interface UniversityListResult {
  universities: University[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type Row = Parameters<typeof mapTargetUniversityRow>[0];

type SupabaseListQuery = {
  eq: (column: string, value: unknown) => SupabaseListQuery;
  or: (filters: string) => SupabaseListQuery;
  not: (column: string, operator: string, value: unknown) => SupabaseListQuery;
  is: (column: string, value: unknown) => SupabaseListQuery;
  contains: (column: string, value: unknown) => SupabaseListQuery;
  overlaps: (column: string, value: unknown) => SupabaseListQuery;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => SupabaseListQuery;
  range: (from: number, to: number) => SupabaseListQuery;
};

function applyExamFilter(
  query: SupabaseListQuery,
  examType: UniversityExamFilter | undefined,
): SupabaseListQuery {
  if (!examType) return query;
  if (examType === 'SAT') {
    return query.not('min_sat_score', 'is', null);
  }
  if (examType === 'IELTS') {
    return query.not('min_ielts_band', 'is', null).is('min_sat_score', null);
  }
  return query.not('min_alevel', 'is', null);
}

function applyCommonFilters(
  query: SupabaseListQuery,
  filters: UniversityListFilters,
  extendedColumns: boolean,
): SupabaseListQuery {
  let q = query.eq('status', 'published');

  const country = filters.country?.trim();
  if (country && country !== 'ALL' && country !== 'Tümü') {
    q = q.eq('country', country);
  }

  const search = filters.search?.trim();
  if (search) {
    q = q.or(`name.ilike.%${search}%,city.ilike.%${search}%`);
  }

  if (extendedColumns && filters.tuitionTier) {
    q = q.eq('tuition_tier', filters.tuitionTier);
  }

  if (extendedColumns && filters.discipline) {
    const tags = resolveDisciplineTags(filters.discipline);
    if (tags?.length === 1) {
      q = q.contains('disciplines', tags);
    } else if (tags && tags.length > 1) {
      q = q.overlaps('disciplines', tags);
    }
  }

  return applyExamFilter(q, filters.examType);
}

function sortRows(rows: Row[], sortBy: UniversitySortBy): Row[] {
  const copy = [...rows];
  if (sortBy === 'sat_asc') {
    copy.sort((a, b) => {
      const sa = a.min_sat_score;
      const sb = b.min_sat_score;
      if (sa == null && sb == null) return a.name.localeCompare(b.name);
      if (sa == null) return 1;
      if (sb == null) return -1;
      return sa - sb || a.name.localeCompare(b.name);
    });
    return copy;
  }
  if (sortBy === 'tuition_asc') {
    copy.sort((a, b) => {
      const ta = a.tuition_tier as TuitionTier | null | undefined;
      const tb = b.tuition_tier as TuitionTier | null | undefined;
      const ra =
        ta && ta in TUITION_TIER_ORDER ? TUITION_TIER_ORDER[ta] : 99;
      const rb =
        tb && tb in TUITION_TIER_ORDER ? TUITION_TIER_ORDER[tb] : 99;
      return ra - rb || a.name.localeCompare(b.name);
    });
    return copy;
  }
  copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}

async function runListQuery(
  client: SupabaseClient,
  filters: UniversityListFilters,
  select: string,
  extendedColumns: boolean,
  range?: { from: number; to: number },
): Promise<{ rows: Row[]; total: number; error: { code?: string } | null }> {
  let query = client
    .from('target_universities')
    .select(select, { count: 'exact' }) as unknown as SupabaseListQuery;

  query = applyCommonFilters(query, filters, extendedColumns);

  const sortBy = filters.sortBy ?? 'popular';
  if (sortBy === 'sat_asc') {
    query = query.order('min_sat_score', {
      ascending: true,
      nullsFirst: false,
    });
  } else if (sortBy !== 'tuition_asc') {
    query = query.order('name', { ascending: true });
  }

  if (range) {
    query = query.range(range.from, range.to);
  }

  const { data, error, count } = await (query as unknown as Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
    count: number | null;
  }>);

  return {
    rows: (data ?? []) as Row[],
    total: count ?? (Array.isArray(data) ? data.length : 0),
    error,
  };
}

export async function fetchPublishedUniversitiesList(
  client: SupabaseClient,
  filters: UniversityListFilters = {},
): Promise<UniversityListResult> {
  const pageSize = Math.min(
    48,
    Math.max(1, filters.pageSize ?? DEFAULT_UNIVERSITY_PAGE_SIZE),
  );
  const page = Math.max(1, filters.page ?? 1);
  const sortBy = filters.sortBy ?? 'popular';
  const needsClientSort = sortBy === 'tuition_asc';

  let select = TARGET_UNIVERSITY_SELECT;

  if (needsClientSort) {
    let result = await runListQuery(client, filters, select, true);
    if (result.error?.code === '42703') {
      select = TARGET_UNIVERSITY_SELECT_LEGACY;
      result = await runListQuery(client, filters, select, false);
    }
    if (result.error) {
      throw result.error;
    }
    const sorted = sortRows(result.rows, sortBy);
    const total = result.total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * pageSize;
    return {
      universities: sorted
        .slice(from, from + pageSize)
        .map(mapTargetUniversityRow),
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let result = await runListQuery(client, filters, select, true, { from, to });

  if (result.error?.code === '42703') {
    select = TARGET_UNIVERSITY_SELECT_LEGACY;
    result = await runListQuery(client, filters, select, false, { from, to });
  }

  if (result.error) {
    throw result.error;
  }

  const total = result.total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  return {
    universities: result.rows.map(mapTargetUniversityRow),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
