import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractRecentScoresFromAttempts,
  parseIeltsBandFromAttempt,
  parseSatScoreFromAttempt,
  type StudentRecentScores,
} from '@/lib/student-command-center/attempt-scores';
import { parseCaieGradeFromScaledResult } from '@/lib/universities/caie-grade';
import type { StudentLatestScores } from '@/lib/universities/types';
import { ATTEMPTS_TABLE, getSupabaseAdmin } from '@/lib/supabase';

export type OfficialAttemptRow = {
  curriculum?: string;
  raw_score: unknown;
  scaled_result: unknown;
  created_at?: string;
  assignment_id?: string | null;
};

export async function loadExamAssignmentIds(
  profilesClient: SupabaseClient,
  studentId: string,
): Promise<Set<string>> {
  const { data, error } = await profilesClient
    .from('assignments')
    .select('id')
    .eq('student_id', studentId)
    .eq('assignment_type', 'exam');

  if (error) {
    console.error(
      '[command-center] Resmi sınav atamaları okunamadı:',
      error.message,
    );
    return new Set();
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { id?: string }).id;
    if (typeof id === 'string' && id) ids.add(id);
  }
  return ids;
}

function hasValidRawScore(raw: unknown): boolean {
  return typeof raw === 'number' && Number.isFinite(raw);
}

/** Atamalı deneme → yalnızca `assignment_type = exam`; atamasız → tamamlanmış ölçek sonucu gerekir. */
export function isOfficialCompletedAttempt(
  row: OfficialAttemptRow,
  examAssignmentIds: Set<string>,
): boolean {
  if (!hasValidRawScore(row.raw_score)) {
    return false;
  }

  const assignmentId = row.assignment_id;
  if (typeof assignmentId === 'string' && assignmentId.trim()) {
    return examAssignmentIds.has(assignmentId);
  }

  const scaled = row.scaled_result;
  return typeof scaled === 'string' && scaled.trim().length > 0;
}

export function extractBestMatchScoresFromOfficialAttempts(
  rows: OfficialAttemptRow[],
): StudentLatestScores {
  let bestSat: number | null = null;
  let bestIelts: number | null = null;
  let latestCaieGrade: string | null = null;

  for (const row of rows) {
    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';

    if (curriculum === 'SAT') {
      const score = parseSatScoreFromAttempt(row);
      if (score !== null && (bestSat === null || score > bestSat)) {
        bestSat = score;
      }
    }

    if (curriculum === 'IELTS') {
      const band = parseIeltsBandFromAttempt(row);
      if (band !== null && (bestIelts === null || band > bestIelts)) {
        bestIelts = band;
      }
    }

    if (curriculum === 'CAIE' && latestCaieGrade === null) {
      const grade = parseCaieGradeFromScaledResult(row.scaled_result);
      if (grade) latestCaieGrade = grade;
    }
  }

  return {
    satScore: bestSat,
    ieltsBand: bestIelts,
    caieGrade: latestCaieGrade,
  };
}

export async function loadOfficialExamAttemptsForStudent(
  studentId: string,
  profilesClient: SupabaseClient,
): Promise<OfficialAttemptRow[]> {
  const attemptsClient = getSupabaseAdmin('interscola');
  if (!attemptsClient) return [];

  const [examAssignmentIds, attemptsResult] = await Promise.all([
    loadExamAssignmentIds(profilesClient, studentId),
    attemptsClient
      .from(ATTEMPTS_TABLE)
      .select(
        'curriculum, raw_score, scaled_result, created_at, assignment_id',
      )
      .eq('student_id', studentId)
      .not('raw_score', 'is', null)
      .in('curriculum', ['SAT', 'IELTS', 'CAIE'])
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  if (attemptsResult.error) {
    console.error(
      '[command-center] Resmi deneme skorları okunamadı:',
      attemptsResult.error.message,
    );
    return [];
  }

  const rows = (attemptsResult.data ?? []) as OfficialAttemptRow[];
  return rows.filter((row) =>
    isOfficialCompletedAttempt(row, examAssignmentIds),
  );
}

export function scoresFromOfficialAttempts(rows: OfficialAttemptRow[]): {
  recentScores: StudentRecentScores;
  matchScores: StudentLatestScores;
} {
  return {
    recentScores: extractRecentScoresFromAttempts(rows),
    matchScores: extractBestMatchScoresFromOfficialAttempts(rows),
  };
}
