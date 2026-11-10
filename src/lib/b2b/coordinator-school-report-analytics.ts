import {
  isOfficialCompletedAttempt,
  type OfficialAttemptRow,
} from '@/lib/student-command-center/official-attempts';
import {
  parseIeltsBandFromAttempt,
  parseSatScoreFromAttempt,
} from '@/lib/student-command-center/attempt-scores';
import { ATTEMPTS_TABLE, getSupabaseAdmin } from '@/lib/supabase';
import { formatSupabaseError } from '@/lib/universities/supabase-error';
import {
  aggregateCoordinatorA4CaieAo,
  parseCaieMetricBreakdownSlice,
  type CoordinatorA4CaieAoSummary,
} from '@/lib/b2b/coordinator-a4-caie-ao';
import {
  extractWeaknessTopicsFromEvaluation,
  topWeaknessTopics,
  type WeaknessTopicCount,
} from '@/lib/b2b/weakness-ledger-topics';

const STUDENT_ID_CHUNK = 60;

type ReportAttemptRow = OfficialAttemptRow & {
  student_id?: string;
  max_score?: number | null;
  evaluations?: unknown;
  metric_breakdown?: unknown;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function caiePercentFromAttempt(row: ReportAttemptRow): number | null {
  const breakdown = row.metric_breakdown;
  if (isRecord(breakdown) && typeof breakdown.yuzde === 'number') {
    return Math.min(100, Math.max(0, breakdown.yuzde));
  }
  if (isRecord(breakdown) && typeof breakdown.yuzde === 'string') {
    const n = Number(breakdown.yuzde);
    if (Number.isFinite(n)) return Math.min(100, Math.max(0, n));
  }
  const raw = row.raw_score;
  const max =
    typeof row.max_score === 'number' && row.max_score > 0
      ? row.max_score
      : null;
  if (typeof raw === 'number' && max) {
    return Math.min(100, Math.max(0, Math.round((raw / max) * 100)));
  }
  return null;
}

async function loadExamAssignmentIdsByStudent(
  profilesClient: Awaited<
    ReturnType<typeof import('@/lib/student-profile/load-context').getStudentProfileDbClient>
  >,
  studentIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (const id of studentIds) out.set(id, new Set());
  if (!profilesClient || studentIds.length === 0) return out;

  const { data, error } = await profilesClient
    .from('assignments')
    .select('id, student_id')
    .in('student_id', studentIds)
    .eq('assignment_type', 'exam');

  if (error) return out;

  for (const row of data ?? []) {
    const r = row as { id?: string; student_id?: string };
    if (typeof r.student_id !== 'string' || typeof r.id !== 'string') continue;
    const set = out.get(r.student_id) ?? new Set<string>();
    set.add(r.id);
    out.set(r.student_id, set);
  }
  return out;
}

async function loadReportAttemptRows(
  studentIds: string[],
): Promise<ReportAttemptRow[]> {
  const attemptsClient = getSupabaseAdmin('interscola');
  if (!attemptsClient || studentIds.length === 0) return [];

  const rows: ReportAttemptRow[] = [];
  for (let i = 0; i < studentIds.length; i += STUDENT_ID_CHUNK) {
    const chunk = studentIds.slice(i, i + STUDENT_ID_CHUNK);
    const { data, error } = await attemptsClient
      .from(ATTEMPTS_TABLE)
      .select(
        'student_id, curriculum, raw_score, max_score, scaled_result, evaluations, metric_breakdown, assignment_id, created_at',
      )
      .in('student_id', chunk)
      .not('raw_score', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingAttemptsError(error)) return [];
      console.error(
        '[coordinator-school-report] Denemeler:',
        formatSupabaseError(error),
      );
      return rows;
    }
    for (const row of data ?? []) {
      rows.push(row as ReportAttemptRow);
    }
  }
  return rows;
}

export type CoordinatorSchoolReportAnalytics = {
  caieSuccessPercent: number | null;
  completionRatePercent: number | null;
  criticalWeaknesses: WeaknessTopicCount[];
  caieAo: CoordinatorA4CaieAoSummary;
};

export async function buildCoordinatorSchoolReportAnalytics(
  profilesClient: NonNullable<
    Awaited<
      ReturnType<
        typeof import('@/lib/student-profile/load-context').getStudentProfileDbClient
      >
    >
  >,
  studentUserIds: string[],
  totalActiveStudents: number,
): Promise<CoordinatorSchoolReportAnalytics> {
  if (studentUserIds.length === 0) {
    return {
      caieSuccessPercent: null,
      completionRatePercent: null,
      criticalWeaknesses: [],
      caieAo: aggregateCoordinatorA4CaieAo([]),
    };
  }

  const [assignmentMap, rawRows] = await Promise.all([
    loadExamAssignmentIdsByStudent(profilesClient, studentUserIds),
    loadReportAttemptRows(studentUserIds),
  ]);

  const completed: ReportAttemptRow[] = [];
  const studentsWithAttempt = new Set<string>();
  const topicCounts = new Map<string, number>();
  const caiePercents: number[] = [];
  const caieAoSlices: ReturnType<typeof parseCaieMetricBreakdownSlice>[] = [];

  for (const row of rawRows) {
    const studentId =
      typeof row.student_id === 'string' ? row.student_id : null;
    if (!studentId) continue;
    const examIds = assignmentMap.get(studentId) ?? new Set<string>();
    if (!isOfficialCompletedAttempt(row, examIds)) continue;

    completed.push(row);
    studentsWithAttempt.add(studentId);

    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';
    if (curriculum === 'CAIE') {
      const pct = caiePercentFromAttempt(row);
      if (pct !== null) caiePercents.push(pct);
      const slice = parseCaieMetricBreakdownSlice(row.metric_breakdown);
      if (slice) caieAoSlices.push(slice);
    }

    for (const topic of extractWeaknessTopicsFromEvaluation(row.evaluations)) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  const caieSuccessPercent =
    caiePercents.length > 0
      ? Math.round(
          caiePercents.reduce((sum, v) => sum + v, 0) / caiePercents.length,
        )
      : null;

  const completionRatePercent =
    totalActiveStudents > 0
      ? Math.min(
          100,
          Math.round((studentsWithAttempt.size / totalActiveStudents) * 100),
        )
      : null;

  return {
    caieSuccessPercent,
    completionRatePercent,
    criticalWeaknesses: topWeaknessTopics(topicCounts, 3),
    caieAo: aggregateCoordinatorA4CaieAo(
      caieAoSlices.filter((s): s is NonNullable<typeof s> => s !== null),
    ),
  };
}

export function averageSatForStudents(
  studentIds: string[],
  rows: ReportAttemptRow[],
): number | null {
  if (studentIds.length === 0) return null;
  const idSet = new Set(studentIds);
  const bestByStudent = new Map<string, number>();
  for (const row of rows) {
    const sid = row.student_id;
    if (!sid || !idSet.has(sid)) continue;
    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';
    if (curriculum !== 'SAT') continue;
    const score = parseSatScoreFromAttempt(row);
    if (score === null) continue;
    const prev = bestByStudent.get(sid);
    bestByStudent.set(sid, prev === undefined ? score : Math.max(prev, score));
  }
  const values = [...bestByStudent.values()];
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function averageIeltsForStudents(
  studentIds: string[],
  rows: ReportAttemptRow[],
): number | null {
  if (studentIds.length === 0) return null;
  const idSet = new Set(studentIds);
  const bestByStudent = new Map<string, number>();
  for (const row of rows) {
    const sid = row.student_id;
    if (!sid || !idSet.has(sid)) continue;
    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';
    if (curriculum !== 'IELTS') continue;
    const band = parseIeltsBandFromAttempt(row);
    if (band === null) continue;
    const prev = bestByStudent.get(sid);
    bestByStudent.set(sid, prev === undefined ? band : Math.max(prev, band));
  }
  const values = [...bestByStudent.values()];
  if (values.length === 0) return null;
  return (
    Math.round(
      (values.reduce((a, b) => a + b, 0) / values.length) * 10,
    ) / 10
  );
}

export async function loadReportAttemptRowsForStudents(
  studentIds: string[],
): Promise<ReportAttemptRow[]> {
  return loadReportAttemptRows(studentIds);
}

export async function loadStudentIdsByTeacher(
  profilesClient: NonNullable<
    Awaited<
      ReturnType<
        typeof import('@/lib/student-profile/load-context').getStudentProfileDbClient
      >
    >
  >,
  teacherUserIds: string[],
  orgStudentIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const id of teacherUserIds) out.set(id, []);
  if (teacherUserIds.length === 0 || orgStudentIds.length === 0) return out;

  const { data, error } = await profilesClient
    .from('assignments')
    .select('teacher_id, student_id')
    .in('teacher_id', teacherUserIds)
    .in('student_id', orgStudentIds);

  if (error) return out;

  const sets = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const r = row as { teacher_id?: string; student_id?: string };
    if (typeof r.teacher_id !== 'string' || typeof r.student_id !== 'string') {
      continue;
    }
    const set = sets.get(r.teacher_id) ?? new Set<string>();
    set.add(r.student_id);
    sets.set(r.teacher_id, set);
  }

  for (const [teacherId, set] of sets) {
    out.set(teacherId, [...set]);
  }
  return out;
}
