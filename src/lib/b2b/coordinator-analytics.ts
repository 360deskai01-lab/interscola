import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isOfficialCompletedAttempt,
  type OfficialAttemptRow,
} from '@/lib/student-command-center/official-attempts';
import {
  parseIeltsBandFromAttempt,
  parseSatScoreFromAttempt,
} from '@/lib/student-command-center/attempt-scores';
import { parseCaieGradeFromScaledResult } from '@/lib/universities/caie-grade';
import { ATTEMPTS_TABLE, getSupabaseAdmin } from '@/lib/supabase';
import { formatSupabaseError } from '@/lib/universities/supabase-error';
import type { CoordinatorOrgPerformanceMetrics } from '@/lib/b2b/coordinator-types';

type AttemptRow = OfficialAttemptRow & { student_id?: string };

const EMPTY_METRICS: CoordinatorOrgPerformanceMetrics = {
  avgSatScore: null,
  maxSatScore: null,
  avgIeltsBand: null,
  totalCompletedAttempts: 0,
};

const STUDENT_ID_CHUNK = 60;

function isMissingAttemptsError(error: {
  code?: string;
  message?: string;
}): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

async function loadExamAssignmentIdsByStudent(
  profilesClient: SupabaseClient,
  studentIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (const id of studentIds) out.set(id, new Set());

  if (studentIds.length === 0) return out;

  const { data, error } = await profilesClient
    .from('assignments')
    .select('id, student_id')
    .in('student_id', studentIds)
    .eq('assignment_type', 'exam');

  if (error) {
    console.error(
      '[coordinator-analytics] Atamalar okunamadı:',
      error.message,
    );
    return out;
  }

  for (const row of data ?? []) {
    const r = row as { id?: string; student_id?: string };
    if (typeof r.student_id !== 'string' || typeof r.id !== 'string') continue;
    const set = out.get(r.student_id) ?? new Set<string>();
    set.add(r.id);
    out.set(r.student_id, set);
  }

  return out;
}

async function loadAttemptRowsForStudents(
  studentIds: string[],
): Promise<AttemptRow[]> {
  const attemptsClient = getSupabaseAdmin('interscola');
  if (!attemptsClient || studentIds.length === 0) return [];

  const rows: AttemptRow[] = [];

  for (let i = 0; i < studentIds.length; i += STUDENT_ID_CHUNK) {
    const chunk = studentIds.slice(i, i + STUDENT_ID_CHUNK);
    const { data, error } = await attemptsClient
      .from(ATTEMPTS_TABLE)
      .select(
        'student_id, curriculum, raw_score, scaled_result, created_at, assignment_id',
      )
      .in('student_id', chunk)
      .not('raw_score', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingAttemptsError(error)) return [];
      console.error(
        '[coordinator-analytics] Denemeler okunamadı:',
        formatSupabaseError(error),
      );
      return rows;
    }

    for (const row of data ?? []) {
      rows.push(row as AttemptRow);
    }
  }

  return rows;
}

function formatLastAttemptLabel(row: OfficialAttemptRow): string | null {
  const curriculum =
    typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';

  if (curriculum === 'SAT') {
    const score = parseSatScoreFromAttempt(row);
    return score !== null ? `SAT ${score} /1600` : null;
  }
  if (curriculum === 'IELTS') {
    const band = parseIeltsBandFromAttempt(row);
    return band !== null ? `IELTS Band ${band.toFixed(1)}` : null;
  }
  if (curriculum === 'CAIE') {
    const grade = parseCaieGradeFromScaledResult(
      typeof row.scaled_result === 'string' ? row.scaled_result : '',
    );
    return grade ? `CAIE ${grade}` : null;
  }
  return null;
}

export interface CoordinatorAnalyticsBundle {
  orgPerformance: CoordinatorOrgPerformanceMetrics;
  lastAttemptByStudentId: Map<string, string>;
}

/**
 * Kurumdaki aktif öğrencilerin tamamlanmış resmi denemelerinden B2B metrikler.
 */
export async function loadCoordinatorOrgAnalytics(
  profilesClient: SupabaseClient,
  studentUserIds: string[],
): Promise<CoordinatorAnalyticsBundle> {
  if (studentUserIds.length === 0) {
    return {
      orgPerformance: { ...EMPTY_METRICS },
      lastAttemptByStudentId: new Map(),
    };
  }

  const [assignmentMap, rawRows] = await Promise.all([
    loadExamAssignmentIdsByStudent(profilesClient, studentUserIds),
    loadAttemptRowsForStudents(studentUserIds),
  ]);

  const completed: AttemptRow[] = [];
  for (const row of rawRows) {
    const studentId =
      typeof row.student_id === 'string' ? row.student_id : null;
    if (!studentId) continue;
    const examIds = assignmentMap.get(studentId) ?? new Set<string>();
    if (isOfficialCompletedAttempt(row, examIds)) {
      completed.push(row);
    }
  }

  completed.sort((a, b) => {
    const ta =
      typeof a.created_at === 'string' ? a.created_at : '';
    const tb =
      typeof b.created_at === 'string' ? b.created_at : '';
    return tb.localeCompare(ta);
  });

  const satBestByStudent = new Map<string, number>();
  const ieltsBestByStudent = new Map<string, number>();
  const lastAttemptByStudentId = new Map<string, string>();

  for (const row of completed) {
    const studentId = row.student_id;
    if (!studentId) continue;

    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';

    if (curriculum === 'SAT') {
      const score = parseSatScoreFromAttempt(row);
      if (score !== null) {
        const prev = satBestByStudent.get(studentId);
        satBestByStudent.set(studentId, prev === undefined ? score : Math.max(prev, score));
      }
    }
    if (curriculum === 'IELTS') {
      const band = parseIeltsBandFromAttempt(row);
      if (band !== null) {
        const prev = ieltsBestByStudent.get(studentId);
        ieltsBestByStudent.set(
          studentId,
          prev === undefined ? band : Math.max(prev, band),
        );
      }
    }

    if (!lastAttemptByStudentId.has(studentId)) {
      const label = formatLastAttemptLabel(row);
      if (label) lastAttemptByStudentId.set(studentId, label);
    }
  }

  const satScores = [...satBestByStudent.values()];
  const ieltsBands = [...ieltsBestByStudent.values()];

  const avgSatScore =
    satScores.length > 0
      ? Math.round(
          satScores.reduce((sum, v) => sum + v, 0) / satScores.length,
        )
      : null;
  const maxSatScore =
    satScores.length > 0 ? Math.max(...satScores) : null;
  const avgIeltsBand =
    ieltsBands.length > 0
      ? Math.round(
          (ieltsBands.reduce((sum, v) => sum + v, 0) / ieltsBands.length) * 10,
        ) / 10
      : null;

  return {
    orgPerformance: {
      avgSatScore,
      maxSatScore,
      avgIeltsBand,
      totalCompletedAttempts: completed.length,
    },
    lastAttemptByStudentId,
  };
}
