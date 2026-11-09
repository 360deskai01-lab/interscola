'use server';

import { getCurrentProfile } from '@/lib/auth';
import { getCoordinatorOrganizationContextAction } from '@/lib/b2b/coordinator-actions';
import { isCoordinatorEligibleOrgRole } from '@/lib/b2b/coordinator-types';
import type {
  ApprovedCoordinatorSession,
  CoordinatorDashboardData,
  CoordinatorDashboardLicenseSnapshot,
  CoordinatorTeacherWorkloadRow,
} from '@/app/coordinator/coordinator-dashboard-types';
import { getStudentProfileDbClient } from '@/lib/student-profile/load-context';

async function loadLinkedStudentsPerTeacher(
  client: NonNullable<Awaited<ReturnType<typeof getStudentProfileDbClient>>>,
  studentUserIds: string[],
  teacherUserIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const id of teacherUserIds) counts.set(id, 0);
  if (studentUserIds.length === 0 || teacherUserIds.length === 0) return counts;

  const { data, error } = await client
    .from('assignments')
    .select('teacher_id, student_id')
    .in('student_id', studentUserIds)
    .in('teacher_id', teacherUserIds);

  if (error) {
    console.error(
      '[coordinator-actions] Öğretmen–öğrenci atamaları:',
      error.message,
    );
    return counts;
  }

  const distinctByTeacher = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const r = row as { teacher_id?: string; student_id?: string };
    if (typeof r.teacher_id !== 'string' || typeof r.student_id !== 'string') {
      continue;
    }
    const set = distinctByTeacher.get(r.teacher_id) ?? new Set<string>();
    set.add(r.student_id);
    distinctByTeacher.set(r.teacher_id, set);
  }

  for (const [teacherId, set] of distinctByTeacher) {
    counts.set(teacherId, set.size);
  }
  return counts;
}

function specialtyLabelForTeacher(
  branchName: string | null,
  targetExamLabels: string[],
): string {
  if (targetExamLabels.length > 0) {
    return targetExamLabels.join(' · ');
  }
  if (branchName?.trim()) return branchName.trim();
  return 'Genel müfredat';
}

export async function requireApprovedCoordinator(): Promise<ApprovedCoordinatorSession | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.status !== 'approved') return null;

  const fullName =
    current.profile.full_name?.trim() ||
    current.user.email?.trim() ||
    'Koordinatör';

  if (current.profile.role === 'admin') {
    return {
      userId: current.user.id,
      email: current.user.email ?? null,
      fullName,
      isPlatformAdmin: true,
      orgRole: 'admin',
    };
  }

  const client = await getStudentProfileDbClient();
  if (!client) return null;

  const { data: membershipRows, error } = await client
    .from('organization_members')
    .select('org_role')
    .eq('user_id', current.user.id)
    .eq('is_active', true);

  if (error) {
    console.error('[coordinator-actions] Üyelik okunamadı:', error.message);
    return null;
  }

  const eligible = (membershipRows ?? []).find((row) =>
    isCoordinatorEligibleOrgRole(
      (row as { org_role?: string | null }).org_role,
    ),
  );

  if (!eligible) return null;

  const orgRole = (eligible as { org_role: string }).org_role;
  return {
    userId: current.user.id,
    email: current.user.email ?? null,
    fullName,
    isPlatformAdmin: false,
    orgRole: isCoordinatorEligibleOrgRole(orgRole) ? orgRole : null,
  };
}

export async function getCoordinatorDashboardDataAction(): Promise<{
  success: boolean;
  error?: string;
  data?: CoordinatorDashboardData;
}> {
  const gate = await requireApprovedCoordinator();
  if (!gate) {
    return {
      success: false,
      error: 'Onaylı koordinatör veya yönetici oturumu gerekir.',
    };
  }

  const contextResult = await getCoordinatorOrganizationContextAction();
  if (!contextResult.success || !contextResult.data) {
    return {
      success: false,
      error:
        contextResult.error ??
        (gate.isPlatformAdmin
          ? 'Platform yöneticisi için bağlı kurum üyeliği bulunamadı.'
          : 'Kurum verisi yüklenemedi.'),
    };
  }

  const context = contextResult.data;
  const org = context.organization;

  const client = await getStudentProfileDbClient();
  const studentUserIds = context.students.map((s) => s.userId);
  const teacherUserIds = context.teachers.map((t) => t.userId);

  const linkedCounts =
    client && teacherUserIds.length > 0
      ? await loadLinkedStudentsPerTeacher(
          client,
          studentUserIds,
          teacherUserIds,
        )
      : new Map<string, number>();

  const teachersWithLoad: CoordinatorTeacherWorkloadRow[] = context.teachers.map(
    (t) => ({
      memberId: t.id,
      userId: t.userId,
      displayName: t.displayName,
      email: t.email,
      branchName: t.branchName,
      specialtyLabel: specialtyLabelForTeacher(
        t.branchName,
        t.targetExamLabels,
      ),
      linkedStudentCount: linkedCounts.get(t.userId) ?? 0,
    }),
  );

  const license: CoordinatorDashboardLicenseSnapshot = {
    studentQuota: org.studentQuota,
    studentsActive: org.seatsUsed,
    seatsRemaining: org.seatsRemaining,
    usagePercent: org.usagePercent,
    isQuotaFull: org.isQuotaFull,
    teachersActive: context.teachers.length,
    teacherQuota: null,
  };

  return {
    success: true,
    data: {
      context,
      license,
      joinCode: org.joinCode,
      teachersWithLoad,
    },
  };
}
