import { isRecord } from '@/lib/exam-shared';
import { ATTEMPTS_TABLE, getSupabaseAdmin } from '@/lib/supabase';

export interface StudentAttemptAnalyticsPoint {
  id: string;
  examTitle: string;
  curriculum: string;
  scaledResult: string;
  percentage: number;
  createdAt: string;
  evaluations: Record<string, unknown> | null;
  remedialTopics: string[];
}

export interface StudentAnalyticsDelta {
  firstPercentage: number;
  lastPercentage: number;
  netChange: number;
  attemptCount: number;
}

export interface StudentLearningGap {
  topic: string;
  count: number;
}

export interface StudentAnalyticsData {
  attempts: StudentAttemptAnalyticsPoint[];
  delta: StudentAnalyticsDelta | null;
  learningGaps: StudentLearningGap[];
}

export type AnalyticsCurriculumFilter = 'ALL' | 'SAT' | 'IELTS' | 'CAIE';

export const ANALYTICS_CURRICULUM_FILTERS: {
  id: AnalyticsCurriculumFilter;
  label: string;
  code?: string;
}[] = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'SAT', label: 'Digital SAT', code: 'SAT' },
  { id: 'IELTS', label: 'IELTS Academic', code: 'IELTS' },
  { id: 'CAIE', label: 'CAIE A-Level', code: 'CAIE' },
];

export function filterAttemptsByCurriculum(
  attempts: StudentAttemptAnalyticsPoint[],
  filter: AnalyticsCurriculumFilter,
): StudentAttemptAnalyticsPoint[] {
  if (filter === 'ALL') return attempts;
  const code = filter;
  return attempts.filter(
    (attempt) => attempt.curriculum.toUpperCase() === code,
  );
}

export function deriveAnalyticsFromAttempts(
  attempts: StudentAttemptAnalyticsPoint[],
): StudentAnalyticsData {
  return {
    attempts,
    delta: buildDeltaSummary(attempts),
    learningGaps: buildLearningGaps(attempts),
  };
}

function isMissingStudentColumnError(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  const haystack =
    `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    haystack.includes('student_id') ||
    haystack.includes('schema cache')
  );
}

function normalizeGapTopic(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function collectRemedialTopicsFromEvaluations(
  evaluations: unknown,
): string[] {
  if (!isRecord(evaluations)) return [];

  const topics: string[] = [];
  const topLevel = evaluations.remedialTopics;
  if (Array.isArray(topLevel)) {
    for (const item of topLevel) {
      if (typeof item === 'string' && item.trim()) {
        topics.push(normalizeGapTopic(item));
      }
    }
  }

  for (const value of Object.values(evaluations)) {
    if (!isRecord(value)) continue;
    const nested = value.remedialTopics;
    if (!Array.isArray(nested)) continue;
    for (const item of nested) {
      if (typeof item === 'string' && item.trim()) {
        topics.push(normalizeGapTopic(item));
      }
    }
  }

  return topics;
}

function buildLearningGaps(
  attempts: StudentAttemptAnalyticsPoint[],
  limit = 10,
): StudentLearningGap[] {
  const frequency = new Map<string, number>();

  for (const attempt of attempts) {
    const seenInAttempt = new Set<string>();
    const topics = [
      ...attempt.remedialTopics.map(normalizeGapTopic),
      ...collectRemedialTopicsFromEvaluations(attempt.evaluations),
    ];

    for (const topic of topics) {
      if (!topic || seenInAttempt.has(topic)) continue;
      seenInAttempt.add(topic);
      frequency.set(topic, (frequency.get(topic) ?? 0) + 1);
    }
  }

  return [...frequency.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'tr'))
    .slice(0, limit);
}

function buildDeltaSummary(
  attempts: StudentAttemptAnalyticsPoint[],
): StudentAnalyticsDelta | null {
  if (attempts.length === 0) return null;

  const first = attempts[0]!.percentage;
  const last = attempts[attempts.length - 1]!.percentage;

  return {
    firstPercentage: first,
    lastPercentage: last,
    netChange: last - first,
    attemptCount: attempts.length,
  };
}

function mapAttemptRows(data: unknown[]): StudentAttemptAnalyticsPoint[] {
  const attempts: StudentAttemptAnalyticsPoint[] = [];

  for (const row of data) {
    if (!isRecord(row)) continue;
    const raw = row as {
      id: unknown;
      curriculum: unknown;
      exam_title: unknown;
      percentage: unknown;
      scaled_result: unknown;
      evaluations: unknown;
      created_at: unknown;
    };

    if (typeof raw.id !== 'string') continue;

    const percentage =
      typeof raw.percentage === 'number' && Number.isFinite(raw.percentage)
        ? raw.percentage
        : 0;

    const evaluations = isRecord(raw.evaluations)
      ? (raw.evaluations as Record<string, unknown>)
      : null;

    const remedialFromEval = evaluations
      ? collectRemedialTopicsFromEvaluations(evaluations)
      : [];

    attempts.push({
      id: raw.id,
      examTitle:
        typeof raw.exam_title === 'string' && raw.exam_title.trim()
          ? raw.exam_title.trim()
          : 'Deneme',
      curriculum:
        typeof raw.curriculum === 'string' && raw.curriculum.trim()
          ? raw.curriculum.trim()
          : 'SAT',
      scaledResult:
        typeof raw.scaled_result === 'string' && raw.scaled_result.trim()
          ? raw.scaled_result.trim()
          : '—',
      percentage,
      createdAt:
        typeof raw.created_at === 'string'
          ? raw.created_at
          : new Date().toISOString(),
      evaluations,
      remedialTopics: remedialFromEval,
    });
  }

  return attempts;
}

/**
 * Belirli bir öğrencinin deneme geçmişinden analitik paket üretir.
 */
export async function loadStudentAnalyticsData(
  studentUserId: string,
): Promise<{ ok: true; data: StudentAnalyticsData } | { ok: false; error: string }> {
  const attemptsClient = getSupabaseAdmin('interscola');
  if (!attemptsClient) {
    return { ok: false, error: 'Deneme kayıtları okunamadı.' };
  }

  const selectColumns =
    'id, curriculum, exam_title, percentage, scaled_result, evaluations, created_at';

  const { data, error } = await attemptsClient
    .from(ATTEMPTS_TABLE)
    .select(selectColumns)
    .eq('student_id', studentUserId)
    .order('created_at', { ascending: true });

  if (error && isMissingStudentColumnError(error)) {
    return {
      ok: true,
      data: { attempts: [], delta: null, learningGaps: [] },
    };
  }

  if (error) {
    console.error('[analytics] Denemeler okunamadı:', error.message);
    return { ok: false, error: 'Gelişim verisi yüklenemedi.' };
  }

  const attempts = mapAttemptRows(data ?? []);
  return {
    ok: true,
    data: deriveAnalyticsFromAttempts(attempts),
  };
}
