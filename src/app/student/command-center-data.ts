'use server';

import {
  loadOfficialExamAttemptsForStudent,
  scoresFromOfficialAttempts,
} from '@/lib/student-command-center/official-attempts';
import { loadStudentCareerSnapshot } from '@/lib/student-dashboard/load-career-assessment';
import { buildUniversityThresholdProgressList } from '@/lib/student-dashboard/university-threshold-progress';
import type { StudentCommandCenterData } from '@/lib/student-command-center/types';
import {
  getStudentProfileDbClient,
  loadStudentGoalsContext,
} from '@/lib/student-profile/load-context';
import {
  mapTargetUniversityRow,
  TARGET_UNIVERSITY_SELECT,
} from '@/lib/universities/repository';
import type { University } from '@/lib/universities/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentProfile } from '@/lib/auth';

const PINNED_UNIVERSITY_LIMIT = 4;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchPinnedUniversities(
  client: SupabaseClient,
  ids: string[],
): Promise<University[]> {
  const ordered = ids
    .filter((id) => UUID_PATTERN.test(id))
    .slice(0, PINNED_UNIVERSITY_LIMIT);
  if (ordered.length === 0) return [];

  const { data, error } = await client
    .from('target_universities')
    .select(TARGET_UNIVERSITY_SELECT)
    .in('id', ordered);

  if (error) {
    console.error('[command-center] Pin üniversiteler okunamadı:', error.message);
    return [];
  }

  const byId = new Map<string, University>();
  for (const row of data ?? []) {
    const mapped = mapTargetUniversityRow(
      row as Parameters<typeof mapTargetUniversityRow>[0],
    );
    byId.set(mapped.id, mapped);
  }

  return ordered
    .map((id) => byId.get(id))
    .filter((item): item is University => item !== undefined);
}

export async function getStudentCommandCenterDataAction(): Promise<{
  success: boolean;
  error?: string;
  data?: StudentCommandCenterData;
}> {
  try {
    const current = await getCurrentProfile();
    if (
      !current ||
      current.profile.role !== 'student' ||
      current.profile.status !== 'approved'
    ) {
      return { success: false, error: 'Onaylı öğrenci oturumu gerekir.' };
    }

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const userId = current.user.id;

    const [goalsLoad, officialAttemptRows] = await Promise.all([
      loadStudentGoalsContext(client, userId),
      loadOfficialExamAttemptsForStudent(userId, client),
    ]);

    if (!goalsLoad.ok) {
      return { success: false, error: goalsLoad.error };
    }

    const goals = goalsLoad.data;
    const pinnedUniversities = await fetchPinnedUniversities(
      client,
      goals.targetUniversityIds,
    );

    const { recentScores, matchScores } =
      scoresFromOfficialAttempts(officialAttemptRows);

    const [careerBase, universityThresholds] = await Promise.all([
      loadStudentCareerSnapshot(client, userId),
      Promise.resolve(
        buildUniversityThresholdProgressList(pinnedUniversities, matchScores),
      ),
    ]);

    const career = {
      ...careerBase,
      pinnedUniversityNames: pinnedUniversities.map((u) => u.name),
    };

    return {
      success: true,
      data: {
        goals,
        pinnedUniversities,
        recentScores,
        matchScores,
        career,
        universityThresholds,
      },
    };
  } catch (error) {
    console.error(
      '[command-center] getStudentCommandCenterDataAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Komuta merkezi verisi yüklenemedi.' };
  }
}
