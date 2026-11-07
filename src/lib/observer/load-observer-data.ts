import type { StudentAnalyticsData } from '@/lib/student-analytics';
import { loadStudentAnalyticsData } from '@/lib/student-analytics';
import {
  loadOfficialExamAttemptsForStudent,
  scoresFromOfficialAttempts,
} from '@/lib/student-command-center/official-attempts';
import type { StudentCommandCenterData } from '@/lib/student-command-center/types';
import { fetchNearestOfficialExamSchedule } from '@/lib/exam-radar/repository';
import { enrichOfficialExamRadar } from '@/lib/exam-radar/load-exam-radar';
import {
  buildStudentScoreRunways,
  type StudentScoreRunwayBundle,
} from '@/lib/score-runway/build-student-runway';
import { parseActivityPassport } from '@/lib/student-portfolio/parse-portfolio';
import type { ActivityItem } from '@/lib/student-portfolio/types';
import {
  getStudentProfileDbClient,
  loadStudentGoalsContext,
  parseInterestTags,
  parseUniversityIds,
} from '@/lib/student-profile/load-context';
import {
  mapTargetUniversityRow,
  TARGET_UNIVERSITY_SELECT,
} from '@/lib/universities/repository';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import type { OfficialExamRadarData } from '@/types/exam-radar';

export interface ObserverAttemptSummary {
  id: string;
  examTitle: string;
  curriculum: string;
  scaledResult: string;
  percentage: number;
  createdAt: string;
}

export interface ObserverReportData {
  profile: {
    displayName: string;
    highSchoolName: string | null;
    graduationYear: number | null;
    curriculums: string[];
    curriculumLabels: string[];
    interestTags: string[];
    pinnedUniversityNames: string[];
  };
  kpis: {
    latestSat: number | null;
    latestIelts: number | null;
    attemptCount: number;
  };
  runwayBundle: StudentScoreRunwayBundle;
  recentAttempts: ObserverAttemptSummary[];
  highlightActivities: ActivityItem[];
  activityCount: number;
  generatedAt: string;
}

const CURRICULUM_LABELS: Record<string, string> = {
  SAT: 'Digital SAT',
  IELTS: 'IELTS Academic',
  CAIE: 'CAIE A-Level',
};

const HIGHLIGHT_CATEGORIES = new Set([
  'leadership',
  'academic_competitions',
  'internship_work',
]);

function displayNameFromRow(row: {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
}): string {
  const composed = [row.first_name, row.last_name]
    .filter((p) => typeof p === 'string' && p.trim())
    .join(' ')
    .trim();
  if (composed) return composed;
  const full = row.full_name?.trim();
  return full || 'Öğrenci';
}

async function readStudentCurriculums(userId: string): Promise<string[]> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!admin) return [];

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return [];
    const raw = data.user.user_metadata?.selected_curriculums;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

async function loadPinnedUniversityNames(
  client: NonNullable<Awaited<ReturnType<typeof getStudentProfileDbClient>>>,
  ids: string[],
): Promise<string[]> {
  const ordered = ids.slice(0, 6);
  if (ordered.length === 0) return [];

  const { data, error } = await client
    .from('target_universities')
    .select(TARGET_UNIVERSITY_SELECT)
    .in('id', ordered);

  if (error) {
    console.error('[observer] pin üniversiteler:', error.message);
    return [];
  }

  const byId = new Map<string, string>();
  for (const row of data ?? []) {
    const mapped = mapTargetUniversityRow(
      row as Parameters<typeof mapTargetUniversityRow>[0],
    );
    byId.set(mapped.id, mapped.name);
  }

  return ordered
    .map((id) => byId.get(id))
    .filter((name): name is string => Boolean(name));
}

function emptyCareerShell(): StudentCommandCenterData['career'] {
  return {
    hasAssessment: false,
    topTraits: [],
    radarData: [],
    primaryMajors: [],
    secondaryMajors: [],
    suggestedMajors: [],
    pinnedUniversityNames: [],
    inventoryTriad: {
      cards: [],
      synthesis: { primaryMajors: [], secondaryMajors: [] },
      completedStageCount: 0,
      totalStages: 3,
      progressPercent: 0,
    },
  };
}

function buildRecentAttempts(
  analytics: StudentAnalyticsData,
  limit = 6,
): ObserverAttemptSummary[] {
  return [...analytics.attempts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      examTitle: a.examTitle,
      curriculum: a.curriculum,
      scaledResult: a.scaledResult,
      percentage: a.percentage,
      createdAt: a.createdAt,
    }));
}

function pickHighlightActivities(items: ActivityItem[]): ActivityItem[] {
  const highlighted = items.filter((item) =>
    HIGHLIGHT_CATEGORIES.has(item.category),
  );
  const source = highlighted.length > 0 ? highlighted : items;
  return source.slice(0, 8);
}

async function resolveExamRadar(
  curriculums: string[],
): Promise<OfficialExamRadarData> {
  const nearest = await fetchNearestOfficialExamSchedule();
  const upper = curriculums.map((c) => c.toUpperCase());
  return enrichOfficialExamRadar(
    { nearestExam: nearest, centers: [], userCity: null },
    {
      preferTrack:
        upper.includes('SAT') || !upper.includes('IELTS') ? 'SAT' : 'IELTS',
    },
  );
}

export type LoadObserverReportResult =
  | { ok: true; data: ObserverReportData }
  | { ok: false; reason: 'not_found' | 'unavailable' };

/**
 * Token = `profiles.observer_link_token`. Sunucu tarafı service-role ile salt okunur paket.
 */
export async function loadObserverReportByToken(
  token: string,
): Promise<LoadObserverReportResult> {
  const client = await getStudentProfileDbClient();
  if (!client) return { ok: false, reason: 'unavailable' };

  const { data: profileRow, error: profileError } = await client
    .from('profiles')
    .select(
      `
      id,
      role,
      status,
      first_name,
      last_name,
      full_name,
      high_school_name,
      graduation_year,
      activity_passport,
      target_university_ids,
      target_interest_tags
    `,
    )
    .eq('observer_link_token', token)
    .maybeSingle();

  if (profileError) {
    console.error('[observer] profil:', profileError.message);
    return { ok: false, reason: 'unavailable' };
  }

  if (
    !profileRow ||
    profileRow.role !== 'student' ||
    profileRow.status !== 'approved'
  ) {
    return { ok: false, reason: 'not_found' };
  }

  const studentId = profileRow.id as string;

  const [goalsLoad, analyticsLoad, curriculums, officialRows] = await Promise.all(
    [
      loadStudentGoalsContext(client, studentId),
      loadStudentAnalyticsData(studentId),
      readStudentCurriculums(studentId),
      loadOfficialExamAttemptsForStudent(studentId, client),
    ],
  );

  const examRadar = await resolveExamRadar(curriculums);

  if (!goalsLoad.ok) return { ok: false, reason: 'unavailable' };
  if (!analyticsLoad.ok) return { ok: false, reason: 'unavailable' };

  const goals = goalsLoad.data;
  const analytics = analyticsLoad.data;
  const universityIds = parseUniversityIds(profileRow.target_university_ids);
  const interestTags = parseInterestTags(profileRow.target_interest_tags);
  const pinnedNames = await loadPinnedUniversityNames(client, universityIds);

  const { recentScores, matchScores } =
    scoresFromOfficialAttempts(officialRows);

  const commandCenter: StudentCommandCenterData = {
    goals: {
      ...goals,
      interestTags: interestTags.length > 0 ? interestTags : goals.interestTags,
      targetUniversityIds:
        universityIds.length > 0 ? universityIds : goals.targetUniversityIds,
    },
    pinnedUniversities: [],
    recentScores,
    matchScores,
    career: {
      ...emptyCareerShell(),
      pinnedUniversityNames: pinnedNames,
    },
    universityThresholds: [],
  };

  const runwayBundle = buildStudentScoreRunways({
    commandCenter,
    analytics,
    examRadar,
    curriculums,
  });

  const passport = parseActivityPassport(profileRow.activity_passport);
  const highlightActivities = pickHighlightActivities(passport.items);

  const curriculumLabels = curriculums.map(
    (code) => CURRICULUM_LABELS[code] ?? code,
  );

  return {
    ok: true,
    data: {
      profile: {
        displayName: displayNameFromRow({
          first_name: profileRow.first_name as string | null,
          last_name: profileRow.last_name as string | null,
          full_name: profileRow.full_name as string | null,
        }),
        highSchoolName: (profileRow.high_school_name as string | null) ?? null,
        graduationYear:
          typeof profileRow.graduation_year === 'number'
            ? profileRow.graduation_year
            : null,
        curriculums,
        curriculumLabels,
        interestTags:
          interestTags.length > 0 ? interestTags : goals.interestTags,
        pinnedUniversityNames: pinnedNames,
      },
      kpis: {
        latestSat: recentScores.satScore,
        latestIelts: recentScores.ieltsBand,
        attemptCount: analytics.attempts.length,
      },
      runwayBundle,
      recentAttempts: buildRecentAttempts(analytics),
      highlightActivities,
      activityCount: passport.items.length,
      generatedAt: new Date().toISOString(),
    },
  };
}
