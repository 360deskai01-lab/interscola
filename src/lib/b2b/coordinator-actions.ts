'use server';

import { getCurrentProfile } from '@/lib/auth';
import { computeSeatUsage } from '@/lib/b2b/license-quota';
import {
  type CoordinatorOrganizationContext,
  isCoordinatorEligibleOrgRole,
} from '@/lib/b2b/coordinator-types';
import {
  getStudentProfileDbClient,
  parseTargetScores,
} from '@/lib/student-profile/load-context';

export async function getCoordinatorOrganizationContextAction(): Promise<{
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

    const coordinatorRow = (membership ?? []).find((row) =>
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

    if (!coordinatorRow) {
      return {
        success: false,
        error: 'Bu işlem için kurum koordinatörü veya yönetici yetkisi gerekir.',
      };
    }

    const organizationId = coordinatorRow.organization_id;

    const [orgResult, branchResult, membersResult] = await Promise.all([
      client
        .from('organizations')
        .select(
          'id, name, license_type, student_quota, valid_until, is_active, join_code',
        )
        .eq('id', organizationId)
        .maybeSingle(),
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

    if (orgResult.error || !orgResult.data) {
      return { success: false, error: 'Kurum bilgisi okunamadı.' };
    }

    const org = orgResult.data as {
      id: string;
      name: string;
      license_type: string | null;
      student_quota: number | null;
      valid_until: string | null;
      is_active: boolean | null;
      join_code?: string | null;
    };

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
    const seatUsage = computeSeatUsage(seatsUsed, org.student_quota);

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
      };
    }

    const teachers = memberRows
      .filter((m) => m.org_role === 'teacher')
      .map(mapMember);
    const students = memberRows
      .filter((m) => m.org_role === 'student')
      .map(mapMember);

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
      },
      branches: branches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
      })),
      teachers,
      students,
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
