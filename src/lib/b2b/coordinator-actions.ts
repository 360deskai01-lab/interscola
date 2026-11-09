'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth';
import { computeSeatUsage } from '@/lib/b2b/license-quota';
import { resolveCoordinatorOrganizationAccess } from '@/lib/b2b/coordinator-org-access';
import { computeTeacherLicenseSnapshot } from '@/lib/b2b/teacher-quota';
import {
  type CoordinatorOrganizationContext,
  isCoordinatorEligibleOrgRole,
} from '@/lib/b2b/coordinator-types';
import { loadCoordinatorOrgAnalytics } from '@/lib/b2b/coordinator-analytics';
import {
  bestScoresFromAttemptRows,
  loadCoordinatorStudentOfficialAttempts,
} from '@/lib/b2b/coordinator-student-detail';
import type { CoordinatorStudentDetail } from '@/lib/b2b/coordinator-types';
import { generateRandomJoinCode } from '@/lib/b2b/join-code';
import {
  getStudentProfileDbClient,
  parseTargetScores,
} from '@/lib/student-profile/load-context';
import { STRICT_UUID_PATTERN } from '@/lib/uuid-patterns';

const COORDINATOR_PATH = '/coordinator';

function studentTargetExamLabels(
  targetScores: Record<string, number | string>,
): string[] {
  const order = ['SAT', 'IELTS', 'CAIE'] as const;
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const key of order) {
    if (targetScores[key] !== undefined) {
      seen.add(key);
      labels.push(key);
    }
  }
  for (const key of Object.keys(targetScores)) {
    if (!seen.has(key)) {
      seen.add(key);
      labels.push(key);
    }
  }
  return labels;
}

type OrganizationRowDb = {
  id: string;
  name: string;
  license_type: string | null;
  student_quota: number | null;
  teacher_quota?: number | null;
  valid_until: string | null;
  is_active: boolean | null;
  join_code?: string | null;
};

async function fetchOrganizationRow(
  client: NonNullable<Awaited<ReturnType<typeof getStudentProfileDbClient>>>,
  organizationId: string,
): Promise<
  { ok: true; row: OrganizationRowDb } | { ok: false; error: string }
> {
  const withTeacher = await client
    .from('organizations')
    .select(
      'id, name, license_type, student_quota, teacher_quota, valid_until, is_active, join_code',
    )
    .eq('id', organizationId)
    .maybeSingle();

  if (!withTeacher.error && withTeacher.data) {
    return { ok: true, row: withTeacher.data as OrganizationRowDb };
  }

  if (withTeacher.error?.code === '42703') {
    const fallback = await client
      .from('organizations')
      .select(
        'id, name, license_type, student_quota, valid_until, is_active, join_code',
      )
      .eq('id', organizationId)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return { ok: false, error: 'Kurum bilgisi okunamadı.' };
    }
    return {
      ok: true,
      row: {
        ...(fallback.data as OrganizationRowDb),
        teacher_quota: null,
      },
    };
  }

  if (withTeacher.error) {
    console.error('[coordinator] Kurum okuma:', withTeacher.error.message);
    return { ok: false, error: 'Kurum bilgisi okunamadı.' };
  }

  return { ok: false, error: 'Kurum bulunamadı.' };
}

async function assertCoordinatorMembership(
  client: Awaited<ReturnType<typeof getStudentProfileDbClient>>,
  userId: string,
  organizationId: string,
  options?: { allowPlatformAdmin?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!client) {
    return { ok: false, error: 'Veritabanı bağlantısı kurulamadı.' };
  }

  if (options?.allowPlatformAdmin) {
    const current = await getCurrentProfile();
    if (current?.profile.role === 'admin' && current.profile.status === 'approved') {
      return { ok: true };
    }
  }

  const { data: membership, error } = await client
    .from('organization_members')
    .select('org_role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[coordinator] Üyelik doğrulama:', error.message);
    return { ok: false, error: 'Kurum yetkisi doğrulanamadı.' };
  }

  const orgRole = (membership as { org_role?: string } | null)?.org_role;
  if (!membership || !isCoordinatorEligibleOrgRole(orgRole)) {
    return {
      ok: false,
      error:
        'Bu işlem için kurum koordinatörü veya yönetici yetkisi gerekir.',
    };
  }

  return { ok: true };
}

export async function listActiveOrganizationsForCoordinatorAdmin(): Promise<{
  success: boolean;
  error?: string;
  organizations?: { id: string; name: string }[];
}> {
  try {
    const current = await getCurrentProfile();
    if (!current || current.profile.status !== 'approved') {
      return { success: false, error: 'Onaylı oturum gerekli.' };
    }
    if (current.profile.role !== 'admin') {
      return { success: true, organizations: [] };
    }

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data, error } = await client
      .from('organizations')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[coordinator] Aktif kurumlar:', error.message);
      return { success: false, error: 'Kurum listesi okunamadı.' };
    }

    return {
      success: true,
      organizations: (data ?? []).map((row) => {
        const r = row as { id: string; name: string };
        return { id: r.id, name: r.name };
      }),
    };
  } catch (error) {
    console.error(
      '[coordinator] listActiveOrganizationsForCoordinatorAdmin:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function getCoordinatorOrganizationContextAction(input?: {
  organizationId?: string;
}): Promise<{
  success: boolean;
  error?: string;
  data?: CoordinatorOrganizationContext;
}> {
  try {
    const current = await getCurrentProfile();
    if (!current) {
      return { success: false, error: 'Oturum gerekli.' };
    }
    if (current.profile.status !== 'approved') {
      return { success: false, error: 'Onaylı hesap gerekli.' };
    }

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const isPlatformAdmin = current.profile.role === 'admin';

    const { data: membership, error: memberError } = await client
      .from('organization_members')
      .select('id, organization_id, org_role, branch_id')
      .eq('user_id', current.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (memberError) {
      console.error('[coordinator] Üyelik okunamadı:', memberError.message);
      return { success: false, error: 'Kurum yetkisi okunamadı.' };
    }

    let coordinatorRow = (membership ?? []).find((row) =>
      isCoordinatorEligibleOrgRole(
        (row as { org_role?: string }).org_role ?? null,
      ),
    ) as
      | {
          id: string;
          organization_id: string;
          org_role: string;
          branch_id: string | null;
        }
      | undefined;

    const membershipOrgId = coordinatorRow?.organization_id ?? null;
    const access = resolveCoordinatorOrganizationAccess({
      isPlatformAdmin,
      membershipOrganizationId: membershipOrgId,
      requestedOrganizationId: input?.organizationId,
    });

    if (!access.allowed) {
      if (access.code === 'foreign_organization') {
        return {
          success: false,
          error: 'Yalnızca bağlı olduğunuz kurumun verilerine erişebilirsiniz.',
        };
      }
      return {
        success: false,
        error: 'Bu işlem için kurum koordinatörü veya yönetici yetkisi gerekir.',
      };
    }

    const organizationId = access.organizationId;
    if (isPlatformAdmin && !coordinatorRow) {
      coordinatorRow = {
        id: 'platform-admin',
        organization_id: organizationId,
        org_role: 'org_admin',
        branch_id: null,
      };
    } else if (!coordinatorRow) {
      return {
        success: false,
        error: 'Bu işlem için kurum koordinatörü veya yönetici yetkisi gerekir.',
      };
    }

    const orgFetch = await fetchOrganizationRow(client, organizationId);
    if (!orgFetch.ok) {
      return { success: false, error: orgFetch.error };
    }

    const org = orgFetch.row;

    const [branchResult, membersResult] = await Promise.all([
      client
        .from('branches')
        .select('id, name, city')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true }),
      client
        .from('organization_members')
        .select('id, user_id, org_role, branch_id, is_active, created_at')
        .eq('organization_id', organizationId)
        .eq('is_active', true),
    ]);

    const branches = (branchResult.data ?? []) as {
      id: string;
      name: string;
      city: string | null;
    }[];

    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

    const memberRows = (membersResult.data ?? []) as {
      id: string;
      user_id: string;
      org_role: string | null;
      branch_id: string | null;
      created_at: string | null;
    }[];

    const seatsUsed = memberRows.filter((m) => m.org_role === 'student').length;
    const teachersUsed = memberRows.filter((m) => m.org_role === 'teacher').length;
    const seatUsage = computeSeatUsage(seatsUsed, org.student_quota);
    const teacherUsage = computeTeacherLicenseSnapshot(
      teachersUsed,
      org.teacher_quota ?? null,
      org.student_quota,
    );

    const userIds = [...new Set(memberRows.map((m) => m.user_id))];
    const profileById = new Map<
      string,
      {
        full_name: string | null;
        email: string | null;
        target_scores: unknown;
      }
    >();

    if (userIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, full_name, email, target_scores')
        .in('id', userIds);
      for (const p of profiles ?? []) {
        const row = p as {
          id: string;
          full_name: string | null;
          email: string | null;
          target_scores?: unknown;
        };
        profileById.set(row.id, {
          full_name: row.full_name,
          email: row.email,
          target_scores: row.target_scores,
        });
      }
    }

    function targetExamLabelsFromProfile(
      orgRole: string | null,
      targetScores: unknown,
    ): string[] {
      if (orgRole !== 'student') return [];
      const scores = parseTargetScores(targetScores);
      const order = ['SAT', 'IELTS', 'CAIE'] as const;
      const seen = new Set<string>();
      const labels: string[] = [];
      for (const key of order) {
        if (scores[key] !== undefined) {
          seen.add(key);
          labels.push(key);
        }
      }
      for (const key of Object.keys(scores)) {
        if (!seen.has(key)) {
          seen.add(key);
          labels.push(key);
        }
      }
      return labels;
    }

    function mapMember(row: (typeof memberRows)[number]) {
      const profile = profileById.get(row.user_id);
      const orgRole = row.org_role ?? 'member';
      return {
        id: row.id,
        userId: row.user_id,
        orgRole,
        branchId: row.branch_id,
        branchName: row.branch_id
          ? (branchNameById.get(row.branch_id) ?? null)
          : null,
        displayName:
          profile?.full_name?.trim() ||
          profile?.email?.trim() ||
          row.user_id.slice(0, 8),
        email: profile?.email ?? null,
        memberCreatedAt: row.created_at,
        targetExamLabels: targetExamLabelsFromProfile(
          orgRole,
          profile?.target_scores,
        ),
        lastAttemptDisplay: null,
      };
    }

    const teachers = memberRows
      .filter((m) => m.org_role === 'teacher')
      .map(mapMember);
    const studentUserIds = memberRows
      .filter((m) => m.org_role === 'student')
      .map((m) => m.user_id);

    const analyticsBundle = await loadCoordinatorOrgAnalytics(
      client,
      studentUserIds,
    );

    function mapStudent(row: (typeof memberRows)[number]) {
      const base = mapMember(row);
      return {
        ...base,
        lastAttemptDisplay:
          analyticsBundle.lastAttemptByStudentId.get(row.user_id) ?? null,
      };
    }

    const students = memberRows
      .filter((m) => m.org_role === 'student')
      .map(mapStudent);

    const context: CoordinatorOrganizationContext = {
      membershipId: coordinatorRow.id,
      orgRole: coordinatorRow.org_role as CoordinatorOrganizationContext['orgRole'],
      organization: {
        id: org.id,
        name: org.name,
        licenseType: org.license_type,
        studentQuota: seatUsage.studentQuota,
        validUntil: org.valid_until,
        isActive: Boolean(org.is_active),
        joinCode: org.join_code?.trim() || null,
        seatsUsed: seatUsage.seatsUsed,
        seatsRemaining: seatUsage.seatsRemaining,
        usagePercent: seatUsage.usagePercent,
        isQuotaFull: seatUsage.isQuotaFull,
        teacherQuota: teacherUsage.teacherQuota,
        teachersUsed: teacherUsage.teachersUsed,
        teachersRemaining: teacherUsage.teachersRemaining,
        teacherUsagePercent: teacherUsage.usagePercent,
        isTeacherQuotaFull: teacherUsage.isTeacherQuotaFull,
      },
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        activeTeacherCount: memberRows.filter(
          (m) => m.org_role === 'teacher' && m.branch_id === b.id,
        ).length,
        activeStudentCount: memberRows.filter(
          (m) => m.org_role === 'student' && m.branch_id === b.id,
        ).length,
      })),
      teachers,
      students,
      orgPerformance: analyticsBundle.orgPerformance,
    };

    return { success: true, data: context };
  } catch (error) {
    console.error(
      '[coordinator] getCoordinatorOrganizationContextAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function rotateCoordinatorJoinCodeAction(input: {
  organizationId: string;
}): Promise<
  | { success: true; newJoinCode: string }
  | { success: false; error: string }
> {
  try {
    const orgId = input.organizationId.trim();
    if (!STRICT_UUID_PATTERN.test(orgId)) {
      return { success: false, error: 'Geçersiz kurum kimliği.' };
    }

    const current = await getCurrentProfile();
    if (!current || current.profile.status !== 'approved') {
      return { success: false, error: 'Onaylı oturum gerekli.' };
    }

    const client = await getStudentProfileDbClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: membership, error: memberError } = await client
      .from('organization_members')
      .select('id, org_role, organization_id')
      .eq('user_id', current.user.id)
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .maybeSingle();

    if (memberError) {
      console.error(
        '[coordinator] rotate join_code üyelik:',
        memberError.message,
      );
      return { success: false, error: 'Kurum yetkisi doğrulanamadı.' };
    }

    const orgRole = (membership as { org_role?: string } | null)?.org_role;
    const adminBypass =
      current.profile.role === 'admin' &&
      current.profile.status === 'approved';
    if (
      !adminBypass &&
      (!membership || !isCoordinatorEligibleOrgRole(orgRole))
    ) {
      return {
        success: false,
        error:
          'Bu işlem için kurum koordinatörü veya yönetici yetkisi gerekir.',
      };
    }

    const { data: orgRow, error: orgError } = await client
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError || !orgRow) {
      return { success: false, error: 'Kurum bulunamadı.' };
    }

    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = generateRandomJoinCode();
      const { error: updateError } = await client
        .from('organizations')
        .update({ join_code: candidate })
        .eq('id', orgId);

      if (!updateError) {
        revalidatePath(COORDINATOR_PATH);
        return { success: true, newJoinCode: candidate };
      }

      if (updateError.code === '23505' && attempt < maxAttempts - 1) {
        continue;
      }

      if (updateError.code === '42703') {
        return {
          success: false,
          error:
            'join_code kolonu veritabanında tanımlı değil. Migration uygulayın.',
        };
      }

      console.error(
        '[coordinator] join_code döndürme:',
        updateError.message,
        updateError.code,
      );
      return { success: false, error: 'Katılım kodu güncellenemedi.' };
    }

    return {
      success: false,
      error: 'Benzersiz katılım kodu üretilemedi. Tekrar deneyin.',
    };
  } catch (error) {
    console.error(
      '[coordinator] rotateCoordinatorJoinCodeAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function getCoordinatorStudentDetailAction(input: {
  organizationId: string;
  studentProfileId: string;
}): Promise<
  | { success: true; studentDetail: CoordinatorStudentDetail }
  | { success: false; error: string }
> {
  try {
    const orgId = input.organizationId.trim();
    const studentId = input.studentProfileId.trim();

    if (!STRICT_UUID_PATTERN.test(orgId) || !STRICT_UUID_PATTERN.test(studentId)) {
      return { success: false, error: 'Geçersiz kimlik.' };
    }

    const current = await getCurrentProfile();
    if (!current || current.profile.status !== 'approved') {
      return { success: false, error: 'Onaylı oturum gerekli.' };
    }

    const client = await getStudentProfileDbClient();
    const gate = await assertCoordinatorMembership(
      client,
      current.user.id,
      orgId,
      { allowPlatformAdmin: true },
    );
    if (!gate.ok) {
      return { success: false, error: gate.error };
    }
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: studentMember, error: studentMemberError } = await client
      .from('organization_members')
      .select('branch_id')
      .eq('organization_id', orgId)
      .eq('user_id', studentId)
      .eq('org_role', 'student')
      .eq('is_active', true)
      .maybeSingle();

    if (studentMemberError) {
      console.error(
        '[coordinator] Öğrenci üyeliği:',
        studentMemberError.message,
      );
      return { success: false, error: 'Öğrenci kurum bağlantısı okunamadı.' };
    }

    if (!studentMember) {
      return {
        success: false,
        error: 'Öğrenci bu kuruma bağlı değil veya aktif değil.',
      };
    }

    const branchId =
      typeof (studentMember as { branch_id?: string | null }).branch_id ===
      'string'
        ? (studentMember as { branch_id: string }).branch_id
        : ((studentMember as { branch_id?: string | null }).branch_id ?? null);

    let branchName: string | null = null;
    if (branchId) {
      const { data: branchRow } = await client
        .from('branches')
        .select('name')
        .eq('id', branchId)
        .maybeSingle();
      branchName =
        typeof (branchRow as { name?: string } | null)?.name === 'string'
          ? (branchRow as { name: string }).name.trim()
          : null;
    }

    const { data: profileRow, error: profileError } = await client
      .from('profiles')
      .select('id, full_name, email, target_scores')
      .eq('id', studentId)
      .maybeSingle();

    if (profileError) {
      if (profileError.code === '42703') {
        const minimal = await client
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', studentId)
          .maybeSingle();
        if (!minimal.data) {
          return { success: false, error: 'Öğrenci profili bulunamadı.' };
        }
        const row = minimal.data as {
          id: string;
          full_name: string | null;
          email: string | null;
        };
        const attempts = await loadCoordinatorStudentOfficialAttempts(
          client,
          studentId,
        );
        const officialRows = attempts.map((a) => ({
          curriculum: a.curriculum,
          raw_score: a.rawScore,
          scaled_result: a.scaledResult,
          created_at: a.createdAt,
          assignment_id: null as string | null,
        }));
        const { bestSat, bestIelts } = bestScoresFromAttemptRows(officialRows);

        return {
          success: true,
          studentDetail: {
            userId: row.id,
            displayName:
              row.full_name?.trim() ||
              row.email?.trim() ||
              studentId.slice(0, 8),
            email: row.email,
            branchId,
            branchName,
            targetExamLabels: [],
            targetScores: {},
            bestSatScore: bestSat,
            bestIeltsBand: bestIelts,
            attempts,
          },
        };
      }
      console.error('[coordinator] Profil okuma:', profileError.message);
      return { success: false, error: 'Öğrenci profili okunamadı.' };
    }

    if (!profileRow) {
      return { success: false, error: 'Öğrenci profili bulunamadı.' };
    }

    const profile = profileRow as {
      id: string;
      full_name: string | null;
      email: string | null;
      target_scores?: unknown;
    };

    const targetScores = parseTargetScores(profile.target_scores);
    const attempts = await loadCoordinatorStudentOfficialAttempts(
      client,
      studentId,
    );
    const officialRows = attempts.map((a) => ({
      curriculum: a.curriculum,
      raw_score: a.rawScore,
      scaled_result: a.scaledResult,
      created_at: a.createdAt,
      assignment_id: null as string | null,
    }));
    const { bestSat, bestIelts } = bestScoresFromAttemptRows(officialRows);

    const studentDetail: CoordinatorStudentDetail = {
      userId: profile.id,
      displayName:
        profile.full_name?.trim() ||
        profile.email?.trim() ||
        profile.id.slice(0, 8),
      email: profile.email ?? null,
      branchId,
      branchName,
      targetExamLabels: studentTargetExamLabels(targetScores),
      targetScores,
      bestSatScore: bestSat,
      bestIeltsBand: bestIelts,
      attempts,
    };

    return { success: true, studentDetail };
  } catch (error) {
    console.error(
      '[coordinator] getCoordinatorStudentDetailAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}
