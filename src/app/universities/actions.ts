'use server';

import { getCurrentProfile } from '@/lib/auth';
import {
  fetchTargetUniversityBySlug,
  fetchUniversityProgramsByUniversityId,
  TARGET_UNIVERSITY_SELECT,
} from '@/lib/universities/repository';
import { ATTEMPTS_TABLE, getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

import { parseCaieGradeFromScaledResult } from '@/lib/universities/caie-grade';
import { formatSupabaseError } from '@/lib/universities/supabase-error';
import {
  fetchPublishedUniversitiesList,
  type UniversityListFilters,
} from '@/lib/universities/list-query';
import type {
  StudentLatestScores,
  University,
  UniversityCountryFilter,
} from '@/lib/universities/types';
import type { UniversityProgram } from '@/types/university';

export type {
  StudentLatestScores,
  University,
  UniversityCountryFilter,
} from '@/lib/universities/types';
export type { UniversityProgram } from '@/types/university';
export type { UniversityListFilters } from '@/lib/universities/list-query';
export type {
  TuitionTier,
  UniversityExamFilter,
  UniversitySortBy,
} from '@/lib/universities/explorer-config';

export type TargetUniversity = University;

export async function getTargetUniversitiesAction(
  filters?: UniversityListFilters,
): Promise<{
  success: boolean;
  error?: string;
  universities?: University[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}> {
  try {
    const client = await getSupabaseServer(PROFILES_SCHEMA);
    if (!client) {
      return {
        success: false,
        error: 'Veritabanı bağlantısı kurulamadı.',
      };
    }

    const result = await fetchPublishedUniversitiesList(client, filters);

    return {
      success: true,
      universities: result.universities,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  } catch (error) {
    console.error(
      '[UNIVERSITIES_FETCH_ERROR]:',
      formatSupabaseError(error),
      { select: TARGET_UNIVERSITY_SELECT },
    );
    return { success: false, error: 'Üniversite rehberi yüklenemedi.' };
  }
}

export async function getUniversityBySlugAction(slug: string): Promise<{
  success: boolean;
  error?: string;
  university?: University;
}> {
  const normalized = slug.trim();
  if (!normalized) {
    return { success: false, error: 'Geçersiz üniversite adresi.' };
  }

  try {
    const university = await fetchTargetUniversityBySlug(normalized);
    if (!university) {
      return { success: false, error: 'Üniversite bulunamadı.' };
    }
    return { success: true, university };
  } catch (error) {
    console.error(
      '[UNIVERSITY_BY_SLUG_ERROR]:',
      formatSupabaseError(error),
      { slug: normalized, select: TARGET_UNIVERSITY_SELECT },
    );
    return { success: false, error: 'Üniversite sayfası yüklenemedi.' };
  }
}

/**
 * Üniversite detayı + program satırları (`university_programs`).
 * Tablo yoksa veya boşsa programlar [] döner.
 */
export async function getUniversityDetailsAction(slug: string): Promise<{
  success: boolean;
  error?: string;
  university?: University;
  programs?: UniversityProgram[];
}> {
  const normalized = slug.trim();
  if (!normalized) {
    return { success: false, error: 'Geçersiz üniversite adresi.' };
  }

  try {
    const university = await fetchTargetUniversityBySlug(normalized);
    if (!university) {
      return { success: false, error: 'Üniversite bulunamadı.' };
    }

    const programs = await fetchUniversityProgramsByUniversityId(university.id);

    return {
      success: true,
      university,
      programs,
    };
  } catch (error) {
    console.error(
      '[UNIVERSITY_DETAILS_ERROR]:',
      formatSupabaseError(error),
      { slug: normalized, select: TARGET_UNIVERSITY_SELECT },
    );
    return { success: false, error: 'Üniversite sayfası yüklenemedi.' };
  }
}

function parseIeltsBandFromAttempt(row: {
  raw_score: unknown;
  scaled_result: unknown;
}): number | null {
  if (typeof row.raw_score === 'number' && Number.isFinite(row.raw_score)) {
    return row.raw_score;
  }
  if (typeof row.scaled_result === 'string') {
    const matched = row.scaled_result.match(/Band\s+([\d.]+)/i);
    if (matched?.[1]) {
      const parsed = Number.parseFloat(matched[1]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function parseSatScoreFromAttempt(row: {
  raw_score: unknown;
  scaled_result: unknown;
}): number | null {
  if (typeof row.raw_score === 'number' && Number.isFinite(row.raw_score)) {
    return Math.round(row.raw_score);
  }
  if (typeof row.scaled_result === 'string') {
    const matched = row.scaled_result.match(/^(\d{3,4})/);
    if (matched?.[1]) {
      const parsed = Number.parseInt(matched[1], 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

/**
 * Onaylı öğrencinin deneme geçmişinden en iyi SAT / IELTS skorları.
 */
export async function getStudentLatestScoresAction(): Promise<StudentLatestScores> {
  const empty: StudentLatestScores = {
    satScore: null,
    ieltsBand: null,
    caieGrade: null,
  };

  try {
    const current = await getCurrentProfile();
    if (
      !current ||
      current.profile.role !== 'student' ||
      current.profile.status !== 'approved'
    ) {
      return empty;
    }

    const attemptsClient = getSupabaseAdmin('interscola');
    if (!attemptsClient) {
      return empty;
    }

    const { data, error } = await attemptsClient
      .from(ATTEMPTS_TABLE)
      .select('curriculum, raw_score, scaled_result, created_at')
      .eq('student_id', current.user.id)
      .in('curriculum', ['SAT', 'IELTS', 'CAIE'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[universities] Öğrenci skorları okunamadı:', error.message);
      return empty;
    }

    let bestSat: number | null = null;
    let bestIelts: number | null = null;
    let latestCaieGrade: string | null = null;

    for (const row of data ?? []) {
      const curriculum =
        typeof (row as { curriculum?: string }).curriculum === 'string'
          ? (row as { curriculum: string }).curriculum.toUpperCase()
          : '';

      if (curriculum === 'SAT') {
        const score = parseSatScoreFromAttempt(
          row as { raw_score: unknown; scaled_result: unknown },
        );
        if (score !== null && (bestSat === null || score > bestSat)) {
          bestSat = score;
        }
      }

      if (curriculum === 'IELTS') {
        const band = parseIeltsBandFromAttempt(
          row as { raw_score: unknown; scaled_result: unknown },
        );
        if (band !== null && (bestIelts === null || band > bestIelts)) {
          bestIelts = band;
        }
      }

      if (curriculum === 'CAIE' && latestCaieGrade === null) {
        const grade = parseCaieGradeFromScaledResult(
          (row as { scaled_result?: unknown }).scaled_result,
        );
        if (grade) {
          latestCaieGrade = grade;
        }
      }
    }

    return {
      satScore: bestSat,
      ieltsBand: bestIelts,
      caieGrade: latestCaieGrade,
    };
  } catch (error) {
    console.error(
      '[universities] getStudentLatestScoresAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return empty;
  }
}
