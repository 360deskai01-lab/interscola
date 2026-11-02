import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  StudentGoalsContext,
  StudentOrganizationLink,
  StudentTargetScores,
  StudentUniversityOption,
} from '@/lib/student-profile/types';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_SCORE_KEYS = new Set(['SAT', 'IELTS', 'CAIE']);

export async function getStudentProfileDbClient(): Promise<SupabaseClient | null> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseTargetScores(raw: unknown): StudentTargetScores {
  if (!isRecord(raw)) return {};
  const out: StudentTargetScores = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_SCORE_KEYS.has(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}

export function parseUniversityIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string =>
      typeof item === 'string' && UUID_PATTERN.test(item),
  );
}

export function computeHasGoals(
  scores: StudentTargetScores,
  universityIds: string[],
): boolean {
  return Object.keys(scores).length > 0 || universityIds.length > 0;
}

async function loadUniversityOptions(
  client: SupabaseClient,
): Promise<StudentUniversityOption[]> {
  const { data, error } = await client
    .from('target_universities')
    .select('id, name, country, city')
    .order('name', { ascending: true });

  if (error) {
    console.error('[student-profile] Üniversite listesi okunamadı:', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const item = row as {
      id: string;
      name: string;
      country: string;
      city: string | null;
    };
    return {
      id: item.id,
      name: item.name,
      country: item.country,
      city: item.city,
    };
  });
}

export async function loadStudentOrganization(
  client: SupabaseClient,
  userId: string,
): Promise<StudentOrganizationLink | null> {
  const { data, error } = await client
    .from('organization_members')
    .select(
      `
      organization_id,
      org_role,
      organizations ( id, name )
    `,
    )
    .eq('user_id', userId)
    .eq('org_role', 'student')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('[student-profile] Kurum üyeliği okunamadı:', error.message);
    }
    return null;
  }

  type Row = {
    organization_id: string;
    organizations:
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
  };

  const row = data as Row;
  const orgRaw = row.organizations;
  const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
  if (!org?.name) return null;

  return {
    organizationId: row.organization_id,
    orgName: org.name,
  };
}

export type LoadStudentGoalsContextResult =
  | { ok: true; data: StudentGoalsContext }
  | { ok: false; error: string; missingProfileColumns?: boolean };

/**
 * Tek okuma döngüsü: profil hedefleri + kurum + üniversite havuzu.
 */
export async function loadStudentGoalsContext(
  client: SupabaseClient,
  userId: string,
): Promise<LoadStudentGoalsContextResult> {
  const [profileResult, universities, organization] = await Promise.all([
    client
      .from('profiles')
      .select('target_scores, target_university_ids')
      .eq('id', userId)
      .maybeSingle(),
    loadUniversityOptions(client),
    loadStudentOrganization(client, userId),
  ]);

  if (profileResult.error) {
    console.error(
      '[student-profile] Profil hedefleri okunamadı:',
      profileResult.error.message,
    );
    if (profileResult.error.code === '42703') {
      return {
        ok: true,
        data: {
          targetScores: {},
          targetUniversityIds: [],
          organization,
          universities,
          hasGoals: false,
        },
      };
    }
    return { ok: false, error: 'Hedef profili okunamadı.' };
  }

  const row = profileResult.data as {
    target_scores?: unknown;
    target_university_ids?: unknown;
  } | null;

  const targetScores = parseTargetScores(row?.target_scores);
  const targetUniversityIds = parseUniversityIds(row?.target_university_ids);

  return {
    ok: true,
    data: {
      targetScores,
      targetUniversityIds,
      organization,
      universities,
      hasGoals: computeHasGoals(targetScores, targetUniversityIds),
    },
  };
}
