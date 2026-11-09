'use server';

import {
  extractWeaknessTopicsFromEvaluation,
  topWeaknessTopics,
} from '@/lib/b2b/weakness-ledger-topics';
import type { ObserverDashboardViewData } from '@/lib/observer/observer-dashboard-types';
import { OBSERVER_INVALID_TOKEN_ERROR } from '@/lib/observer/observer-dashboard-types';
import {
  getStudentProfileDbClient,
  loadStudentGoalsContext,
  parseTargetScores,
} from '@/lib/student-profile/load-context';
import { loadStudentAnalyticsData } from '@/lib/student-analytics';
import type { StudentTargetScores } from '@/lib/student-profile/types';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';

const CURRICULUM_LABELS: Record<string, string> = {
  SAT: 'Digital SAT',
  IELTS: 'IELTS Academic',
  CAIE: 'CAIE A-Level',
};

const HEX_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

function privacyDisplayName(row: {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
}): string {
  const first = row.first_name?.trim();
  const last = row.last_name?.trim();
  if (first && last) {
    const initial = last.charAt(0).toUpperCase();
    return `${first} ${initial}.`;
  }
  const full = row.full_name?.trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]!.charAt(0).toUpperCase()}.`;
    }
    return parts[0] ?? 'Öğrenci';
  }
  return 'Öğrenci';
}

function pickPrimaryExamKey(
  scores: StudentTargetScores,
  attemptCurricula: string[],
): string | null {
  const order = ['SAT', 'IELTS', 'CAIE'];
  for (const key of order) {
    if (scores[key] !== undefined && scores[key] !== null && scores[key] !== '') {
      return key;
    }
  }
  const upper = attemptCurricula.map((c) => c.toUpperCase());
  for (const key of order) {
    if (upper.includes(key)) return key;
  }
  return upper[0] ?? null;
}

function formatTargetScore(key: string, scores: StudentTargetScores): string {
  const raw = scores[key];
  if (raw === undefined || raw === null || raw === '') return '—';
  if (key === 'SAT') return `Hedef: ${raw} puan`;
  if (key === 'IELTS') return `Hedef: Band ${raw}`;
  if (key === 'CAIE') return `Hedef: ${raw}`;
  return `Hedef: ${String(raw)}`;
}

function latestAttemptForCurriculum(
  attempts: { curriculum: string; scaledResult: string; percentage: number; createdAt: string }[],
  key: string,
): { scaledResult: string; percentage: number } | null {
  const filtered = attempts.filter(
    (a) => a.curriculum.toUpperCase() === key.toUpperCase(),
  );
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const latest = sorted[0]!;
  return {
    scaledResult: latest.scaledResult,
    percentage: latest.percentage,
  };
}

function computeOverallPercent(
  attempts: { percentage: number }[],
): number {
  if (attempts.length === 0) return 0;
  const sum = attempts.reduce((acc, row) => acc + row.percentage, 0);
  return Math.round(sum / attempts.length);
}

export async function getObserverDashboardDataAction(
  token: string,
): Promise<
  | { success: true; data: ObserverDashboardViewData }
  | { success: false; error: string }
> {
  const normalized = token.trim();
  if (!HEX_TOKEN_PATTERN.test(normalized)) {
    return { success: false, error: OBSERVER_INVALID_TOKEN_ERROR };
  }

  const client = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!client) {
    return { success: false, error: OBSERVER_INVALID_TOKEN_ERROR };
  }

  const nowIso = new Date().toISOString();

  const { data: tokenRow, error: tokenError } = await client
    .from('student_observer_tokens')
    .select('id, student_id, is_active, expires_at')
    .eq('token', normalized)
    .maybeSingle();

  if (tokenError) {
    console.error('[observer-view] token okuma:', tokenError.message);
    return { success: false, error: OBSERVER_INVALID_TOKEN_ERROR };
  }

  if (
    !tokenRow ||
    !tokenRow.is_active ||
    typeof tokenRow.expires_at !== 'string' ||
    tokenRow.expires_at <= nowIso
  ) {
    return { success: false, error: OBSERVER_INVALID_TOKEN_ERROR };
  }

  const studentId = tokenRow.student_id as string;

  try {
    await client
      .from('student_observer_tokens')
      .update({ last_accessed_at: nowIso })
      .eq('id', tokenRow.id as string);
  } catch {
    /* last_accessed_at güncellemesi başarısız olsa da rapor okunabilir */
  }

  const profileClient = await getStudentProfileDbClient();
  if (!profileClient) {
    return { success: false, error: OBSERVER_INVALID_TOKEN_ERROR };
  }

  const { data: profileRow, error: profileError } = await profileClient
    .from('profiles')
    .select(
      'id, role, status, first_name, last_name, full_name, target_scores',
    )
    .eq('id', studentId)
    .maybeSingle();

  if (
    profileError ||
    !profileRow ||
    profileRow.role !== 'student' ||
    profileRow.status !== 'approved'
  ) {
    return { success: false, error: OBSERVER_INVALID_TOKEN_ERROR };
  }

  const [goalsLoad, analyticsLoad] = await Promise.all([
    loadStudentGoalsContext(profileClient, studentId),
    loadStudentAnalyticsData(studentId),
  ]);

  if (!goalsLoad.ok || !analyticsLoad.ok) {
    return { success: false, error: OBSERVER_INVALID_TOKEN_ERROR };
  }

  const targetScores =
    goalsLoad.data.targetScores ??
    parseTargetScores(profileRow.target_scores);

  const attempts = analyticsLoad.data.attempts;
  const attemptCurricula = attempts.map((a) => a.curriculum);

  const primaryKey = pickPrimaryExamKey(targetScores, attemptCurricula);
  const targetExamLabel = primaryKey
    ? (CURRICULUM_LABELS[primaryKey] ?? primaryKey)
    : 'Hedef sınav';
  const targetScoreLabel = primaryKey
    ? formatTargetScore(primaryKey, targetScores)
    : 'Hedef henüz tanımlanmadı';

  const latestForPrimary = primaryKey
    ? latestAttemptForCurriculum(attempts, primaryKey)
    : null;
  const latestAny =
    attempts.length > 0
      ? [...attempts].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        )[0]
      : null;

  const currentLevelLabel = latestForPrimary
    ? `Güncel: ${latestForPrimary.scaledResult}`
    : latestAny
      ? `Son deneme: ${latestAny.scaledResult}`
      : 'Henüz deneme yok';

  const topicCounts = new Map<string, number>();
  for (const attempt of attempts) {
    const topics = extractWeaknessTopicsFromEvaluation(attempt.evaluations);
    const seen = new Set<string>();
    for (const topic of topics) {
      const key = topic.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      topicCounts.set(key, (topicCounts.get(key) ?? 0) + 1);
    }
  }

  const sortedAttempts = [...attempts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const chronological = [...attempts].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  const data: ObserverDashboardViewData = {
    studentDisplayName: privacyDisplayName({
      first_name: profileRow.first_name as string | null,
      last_name: profileRow.last_name as string | null,
      full_name: profileRow.full_name as string | null,
    }),
    targetExamKey: primaryKey,
    targetExamLabel,
    targetScoreLabel,
    currentLevelLabel,
    attemptCount: attempts.length,
    overallSuccessPercent: computeOverallPercent(attempts),
    attemptHistory: sortedAttempts.map((a) => ({
      id: a.id,
      examTitle: a.examTitle,
      curriculum: a.curriculum,
      scaledResult: a.scaledResult,
      percentage: a.percentage,
      createdAt: a.createdAt,
    })),
    timeline: chronological.map((a) => ({
      createdAt: a.createdAt,
      curriculum: a.curriculum,
      scaledResult: a.scaledResult,
      percentage: a.percentage,
    })),
    topWeaknessTopics: topWeaknessTopics(topicCounts, 3),
    generatedAt: new Date().toISOString(),
  };

  return { success: true, data };
}
