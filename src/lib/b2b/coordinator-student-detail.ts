import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractBestMatchScoresFromOfficialAttempts,
  isOfficialCompletedAttempt,
  loadExamAssignmentIds,
  type OfficialAttemptRow,
} from '@/lib/student-command-center/official-attempts';
import {
  parseIeltsBandFromAttempt,
  parseSatScoreFromAttempt,
} from '@/lib/student-command-center/attempt-scores';
import type { CoordinatorStudentAttemptDetail } from '@/lib/b2b/coordinator-types';
import { ATTEMPTS_TABLE, getSupabaseAdmin } from '@/lib/supabase';

function isMissingSchemaError(error: { code?: string; message?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

function formatScoreLabel(
  curriculum: string,
  row: OfficialAttemptRow & {
    exam_title?: string | null;
    max_score?: number | null;
  },
): string {
  const scaled =
    typeof row.scaled_result === 'string' ? row.scaled_result.trim() : '';
  if (scaled) return scaled;

  const c = curriculum.toUpperCase();
  if (c === 'SAT') {
    const score = parseSatScoreFromAttempt(row);
    const max =
      typeof row.max_score === 'number' && Number.isFinite(row.max_score)
        ? row.max_score
        : 1600;
    return score !== null ? `${score} / ${max}` : '—';
  }
  if (c === 'IELTS') {
    const band = parseIeltsBandFromAttempt(row);
    return band !== null ? `Band ${band.toFixed(1)}` : '—';
  }
  const raw =
    typeof row.raw_score === 'number' && Number.isFinite(row.raw_score)
      ? row.raw_score
      : null;
  const max =
    typeof row.max_score === 'number' && Number.isFinite(row.max_score)
      ? row.max_score
      : null;
  if (raw !== null && max !== null) return `${raw} / ${max}`;
  if (raw !== null) return String(raw);
  return '—';
}

export async function loadCoordinatorStudentOfficialAttempts(
  profilesClient: SupabaseClient,
  studentUserId: string,
): Promise<CoordinatorStudentAttemptDetail[]> {
  const attemptsClient = getSupabaseAdmin('interscola');
  if (!attemptsClient) return [];

  const examAssignmentIds = await loadExamAssignmentIds(
    profilesClient,
    studentUserId,
  );

  const selectWithMax =
    'id, curriculum, exam_title, raw_score, max_score, scaled_result, created_at, assignment_id';
  const selectLegacy =
    'id, curriculum, exam_title, raw_score, scaled_result, created_at, assignment_id';

  let data: unknown[] | null = null;
  let error: { code?: string; message?: string } | null = null;

  const primary = await attemptsClient
    .from(ATTEMPTS_TABLE)
    .select(selectWithMax)
    .eq('student_id', studentUserId)
    .not('raw_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(120);

  data = primary.data;
  error = primary.error;

  if (error && isMissingSchemaError(error)) {
    return [];
  }

  if (error && error.code === '42703') {
    const fallback = await attemptsClient
      .from(ATTEMPTS_TABLE)
      .select(selectLegacy)
      .eq('student_id', studentUserId)
      .not('raw_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(120);
    if (fallback.error) {
      if (isMissingSchemaError(fallback.error)) return [];
      console.error(
        '[coordinator] Öğrenci denemeleri:',
        fallback.error.message,
      );
      return [];
    }
    data = fallback.data;
  } else if (error) {
    console.error('[coordinator] Öğrenci denemeleri:', error.message);
    return [];
  }

  const completed: (OfficialAttemptRow & {
    id?: string;
    exam_title?: string | null;
    max_score?: number | null;
  })[] = [];

  for (const row of data ?? []) {
    const record = row as OfficialAttemptRow & {
      id?: string;
      exam_title?: string | null;
      max_score?: number | null;
    };
    if (isOfficialCompletedAttempt(record, examAssignmentIds)) {
      completed.push(record);
    }
  }

  return completed.map((row) => {
    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.trim() : 'SAT';
    const examTitle =
      typeof row.exam_title === 'string' && row.exam_title.trim()
        ? row.exam_title.trim()
        : 'Deneme';
    const createdAt =
      typeof row.created_at === 'string'
        ? row.created_at
        : new Date().toISOString();
    const rawScore =
      typeof row.raw_score === 'number' && Number.isFinite(row.raw_score)
        ? row.raw_score
        : null;
    const maxScore =
      typeof row.max_score === 'number' && Number.isFinite(row.max_score)
        ? row.max_score
        : null;
    const scaled =
      typeof row.scaled_result === 'string' ? row.scaled_result.trim() : '';

    return {
      id: typeof row.id === 'string' ? row.id : createdAt,
      examTitle,
      curriculum,
      createdAt,
      scaledResult: scaled || '—',
      rawScore,
      maxScore,
      scoreLabel: formatScoreLabel(curriculum, row),
    };
  });
}

export function bestScoresFromAttemptRows(
  rows: OfficialAttemptRow[],
): { bestSat: number | null; bestIelts: number | null } {
  const match = extractBestMatchScoresFromOfficialAttempts(rows);
  return {
    bestSat: match.satScore,
    bestIelts: match.ieltsBand,
  };
}
