'use server';

import { requireApprovedAdmin } from '@/app/admin/actions';
import type {
  ExamAuditEvaluations,
  ExamAuditOriginType,
  ExamAuditSourceKind,
  GlobalExamAuditLogRow,
  GlobalExamAuditMetrics,
  GlobalExamAuditResult,
} from '@/lib/admin/exam-audit-types';
import {
  parseIeltsBandFromAttempt,
  parseSatScoreFromAttempt,
} from '@/lib/student-command-center/attempt-scores';
import { ATTEMPTS_TABLE, getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type DbAttemptRow = {
  id: string;
  exam_title: string | null;
  curriculum: string | null;
  engine_type: string | null;
  raw_score: number | null;
  max_score: number | null;
  percentage: number | null;
  scaled_result: string | null;
  origin_type: string | null;
  assignment_id: string | null;
  student_id: string | null;
  created_at: string;
  evaluations: unknown;
  metric_breakdown: unknown;
};

type DbProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

type DbAssignmentRow = {
  id: string;
  assignment_type: string | null;
};

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function clampPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page)) return DEFAULT_PAGE;
  return Math.max(1, Math.floor(page));
}

function parseOriginType(raw: string | null): ExamAuditOriginType {
  if (raw === 'self_practice' || raw === 'assigned') return raw;
  return null;
}

function parseEvaluations(raw: unknown): ExamAuditEvaluations | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const feedback =
    typeof record.feedback === 'string' ? record.feedback : undefined;
  const remedialTopics = Array.isArray(record.remedialTopics)
    ? record.remedialTopics.filter((item): item is string => typeof item === 'string')
    : undefined;
  const metricBreakdown =
    record.metricBreakdown &&
    typeof record.metricBreakdown === 'object' &&
    !Array.isArray(record.metricBreakdown)
      ? (record.metricBreakdown as Record<string, number | string>)
      : undefined;

  if (!feedback && !remedialTopics?.length && !metricBreakdown) {
    return null;
  }

  return { feedback, remedialTopics, metricBreakdown };
}

function parseMetricBreakdown(raw: unknown): Record<string, number | string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, number | string>;
}

function resolveSourceKind(
  row: DbAttemptRow,
  assignmentType: string | null,
): ExamAuditSourceKind {
  if (!row.student_id) {
    return 'anonymous_pool';
  }

  if (assignmentType === 'exam') {
    return 'teacher_exam';
  }

  if (assignmentType === 'study') {
    return 'teacher_study';
  }

  if (row.origin_type === 'assigned') {
    return 'teacher_exam';
  }

  if (row.origin_type === 'self_practice' || !row.assignment_id) {
    return 'free_diagnostic';
  }

  return 'unknown';
}

function startOfTodayIso(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

async function loadAuditMetrics(
  attemptsClient: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
): Promise<GlobalExamAuditMetrics> {
  const [{ count: totalAttempts, error: totalError }, { count: todayAttempts, error: todayError }] =
    await Promise.all([
      attemptsClient
        .from(ATTEMPTS_TABLE)
        .select('id', { count: 'exact', head: true }),
      attemptsClient
        .from(ATTEMPTS_TABLE)
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfTodayIso()),
    ]);

  if (totalError) {
    console.error('[audit] Toplam deneme sayısı okunamadı:', totalError.message);
  }
  if (todayError) {
    console.error('[audit] Bugünkü deneme sayısı okunamadı:', todayError.message);
  }

  const { data: scoreRows, error: scoreError } = await attemptsClient
    .from(ATTEMPTS_TABLE)
    .select('curriculum, raw_score, scaled_result')
    .in('curriculum', ['SAT', 'IELTS'])
    .not('raw_score', 'is', null)
    .limit(5000);

  if (scoreError) {
    console.error('[audit] Ortalama skor verisi okunamadı:', scoreError.message);
  }

  const satScores: number[] = [];
  const ieltsBands: number[] = [];

  for (const item of scoreRows ?? []) {
    const row = item as {
      curriculum?: string;
      raw_score: unknown;
      scaled_result: unknown;
    };
    const curriculum =
      typeof row.curriculum === 'string' ? row.curriculum.toUpperCase() : '';
    if (curriculum === 'SAT') {
      const score = parseSatScoreFromAttempt(row);
      if (score !== null) satScores.push(score);
    }
    if (curriculum === 'IELTS') {
      const band = parseIeltsBandFromAttempt(row);
      if (band !== null) ieltsBands.push(band);
    }
  }

  const averageSatScore =
    satScores.length > 0
      ? Math.round(
          satScores.reduce((sum, value) => sum + value, 0) / satScores.length,
        )
      : null;

  const averageIeltsBand =
    ieltsBands.length > 0
      ? Math.round(
          (ieltsBands.reduce((sum, value) => sum + value, 0) / ieltsBands.length) *
            10,
        ) / 10
      : null;

  return {
    totalAttempts: totalAttempts ?? 0,
    todayAttempts: todayAttempts ?? 0,
    averageSatScore,
    averageIeltsBand,
  };
}

export async function getGlobalExamAuditLogsAction(options?: {
  page?: number;
  limit?: number;
  curriculum?: string;
}): Promise<{
  success: boolean;
  error?: string;
  data?: GlobalExamAuditResult;
}> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return {
        success: false,
        error: 'Bu veri için master admin yetkisi gerekiyor.',
      };
    }

    const attemptsClient = getSupabaseAdmin('interscola');
    if (!attemptsClient) {
      return { success: false, error: 'Deneme veritabanı bağlantısı kurulamadı.' };
    }

    const page = clampPage(options?.page);
    const limit = clampLimit(options?.limit);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const curriculumFilter = options?.curriculum?.trim().toUpperCase();

    let query = attemptsClient
      .from(ATTEMPTS_TABLE)
      .select(
        'id, exam_title, curriculum, engine_type, raw_score, max_score, percentage, scaled_result, origin_type, assignment_id, student_id, created_at, evaluations, metric_breakdown',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (curriculumFilter && ['SAT', 'IELTS', 'CAIE'].includes(curriculumFilter)) {
      query = query.eq('curriculum', curriculumFilter);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[audit] Deneme listesi okunamadı:', error.message);
      return { success: false, error: 'Sınav denetim günlüğü okunamadı.' };
    }

    const attemptRows = (data ?? []) as DbAttemptRow[];

    const studentIds = [
      ...new Set(
        attemptRows
          .map((row) => row.student_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    const assignmentIds = [
      ...new Set(
        attemptRows
          .map((row) => row.assignment_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    const profilesClient = getSupabaseAdmin(PROFILES_SCHEMA);

    const profileById = new Map<string, DbProfileRow>();
    const assignmentTypeById = new Map<string, string | null>();

    if (profilesClient) {
      if (studentIds.length > 0) {
        const { data: profiles, error: profileError } = await profilesClient
          .from('profiles')
          .select('id, email, full_name')
          .in('id', studentIds);

        if (profileError) {
          console.error('[audit] Profil eşleştirmesi hatası:', profileError.message);
        } else {
          for (const profile of profiles ?? []) {
            const row = profile as DbProfileRow;
            profileById.set(row.id, row);
          }
        }
      }

      if (assignmentIds.length > 0) {
        const { data: assignments, error: assignmentError } = await profilesClient
          .from('assignments')
          .select('id, assignment_type')
          .in('id', assignmentIds);

        if (assignmentError) {
          console.error('[audit] Atama eşleştirmesi hatası:', assignmentError.message);
        } else {
          for (const assignment of assignments ?? []) {
            const row = assignment as DbAssignmentRow;
            assignmentTypeById.set(row.id, row.assignment_type ?? null);
          }
        }
      }
    }

    const rows: GlobalExamAuditLogRow[] = attemptRows.map((row) => {
      const profile = row.student_id ? profileById.get(row.student_id) : undefined;
      const assignmentType = row.assignment_id
        ? (assignmentTypeById.get(row.assignment_id) ?? null)
        : null;

      return {
        id: row.id,
        examTitle: row.exam_title?.trim() || 'Deneme',
        curriculum: row.curriculum?.trim().toUpperCase() || '—',
        engineType: row.engine_type?.trim() || null,
        rawScore:
          typeof row.raw_score === 'number' && Number.isFinite(row.raw_score)
            ? row.raw_score
            : null,
        maxScore:
          typeof row.max_score === 'number' && Number.isFinite(row.max_score)
            ? row.max_score
            : null,
        percentage:
          typeof row.percentage === 'number' && Number.isFinite(row.percentage)
            ? row.percentage
            : null,
        scaledResult: row.scaled_result?.trim() || null,
        originType: parseOriginType(row.origin_type),
        assignmentId: row.assignment_id ?? null,
        assignmentType,
        sourceKind: resolveSourceKind(row, assignmentType),
        studentId: row.student_id ?? null,
        studentFullName: profile?.full_name?.trim() || null,
        studentEmail: profile?.email ?? null,
        createdAt: row.created_at,
        evaluations: parseEvaluations(row.evaluations),
        metricBreakdown: parseMetricBreakdown(row.metric_breakdown),
      };
    });

    const metrics = await loadAuditMetrics(attemptsClient);

    return {
      success: true,
      data: {
        rows,
        total: count ?? rows.length,
        page,
        limit,
        metrics,
      },
    };
  } catch (error) {
    console.error(
      '[audit] getGlobalExamAuditLogsAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Denetim günlüğü yüklenemedi.' };
  }
}
