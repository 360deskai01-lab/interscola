'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth';
import {
  isOrganizationLicenseActive,
  isStudentQuotaExceeded,
  normalizeStudentQuota,
  ORG_JOIN_LICENSE_INACTIVE_MESSAGE,
  ORG_JOIN_QUOTA_FULL_MESSAGE,
  orgJoinTeacherQuotaFullMessage,
} from '@/lib/b2b/license-quota';
import {
  JOIN_CODE_PATTERN,
  normalizeJoinCodeInput,
} from '@/lib/b2b/join-code';
import { resolveTeacherQuota } from '@/lib/b2b/teacher-quota';
import type { JoinOrganizationResult } from '@/lib/student-profile/types';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

const STUDENT_DASHBOARD_PATH = '/student/dashboard';
const STUDENT_CONNECTIONS_PATH = '/student/connections';
const TEACHER_DASHBOARD_PATH = '/teacher/dashboard';

type JoinMemberRole = 'student' | 'teacher';

type OrganizationJoinRow = {
  id: string;
  name: string;
  is_active: boolean | null;
  student_quota: number | null;
  teacher_quota?: number | null;
  valid_until: string | null;
};

async function getProfilesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

async function fetchOrganizationByJoinCode(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  normalizedCode: string,
): Promise<
  | { ok: true; org: OrganizationJoinRow }
  | { ok: false; message: string }
> {
  const withTeacher = await client
    .from('organizations')
    .select(
      'id, name, is_active, join_code, student_quota, teacher_quota, valid_until',
    )
    .eq('join_code', normalizedCode)
    .maybeSingle();

  if (!withTeacher.error && withTeacher.data) {
    return { ok: true, org: withTeacher.data as OrganizationJoinRow };
  }

  if (withTeacher.error?.code === '42703') {
    const fallback = await client
      .from('organizations')
      .select('id, name, is_active, join_code, student_quota, valid_until')
      .eq('join_code', normalizedCode)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return { ok: false, message: ORG_JOIN_LICENSE_INACTIVE_MESSAGE };
    }
    return {
      ok: true,
      org: {
        ...(fallback.data as OrganizationJoinRow),
        teacher_quota: null,
      },
    };
  }

  if (withTeacher.error) {
    console.error('[join-org] Kurum kodu araması:', withTeacher.error.message);
    return { ok: false, message: 'Kurum araması başarısız oldu.' };
  }

  return { ok: false, message: ORG_JOIN_LICENSE_INACTIVE_MESSAGE };
}

/**
 * Kurumsal join_code ile üyelik — öğrenci ve öğretmen rolleri; öğretmen kotası sert kapı.
 */
export async function joinOrganizationWithCodeAction(input: {
  joinCode: string;
  memberRole: JoinMemberRole;
}): Promise<JoinOrganizationResult> {
  try {
    const current = await getCurrentProfile();
    if (!current || current.profile.status !== 'approved') {
      return {
        success: false,
        message: 'Bu işlem için onaylı oturum gerekir.',
      };
    }

    if (input.memberRole === 'student' && current.profile.role !== 'student') {
      return {
        success: false,
        message: 'Kurum kodu ile öğrenci bağlantısı için öğrenci hesabı gerekir.',
      };
    }

    if (
      input.memberRole === 'teacher' &&
      current.profile.role !== 'teacher' &&
      current.profile.role !== 'admin'
    ) {
      return {
        success: false,
        message: 'Kurum kodu ile öğretmen kaydı için öğretmen hesabı gerekir.',
      };
    }

    const userId = current.user.id;
    const normalized = normalizeJoinCodeInput(input.joinCode);
    if (!JOIN_CODE_PATTERN.test(normalized)) {
      return {
        success: false,
        message:
          'Katılım kodu 6 karakter olmalıdır (0/O ve 1/I kullanılmaz).',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, message: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: existingMember, error: existingError } = await client
      .from('organization_members')
      .select('id, organization_id, org_role, organizations ( name )')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (existingError) {
      console.error('[join-org] Mevcut üyelik:', existingError.message);
    } else if (existingMember) {
      const orgName =
        (existingMember as { organizations?: { name?: string } | null })
          .organizations?.name ?? 'kurum';
      return {
        success: false,
        message: `Zaten ${orgName} kurumuna bağlısın.`,
        orgName,
      };
    }

    const orgResult = await fetchOrganizationByJoinCode(client, normalized);
    if (!orgResult.ok) {
      return { success: false, message: orgResult.message };
    }

    const org = orgResult.org;

    if (!isOrganizationLicenseActive(org.is_active, org.valid_until)) {
      return {
        success: false,
        message: ORG_JOIN_LICENSE_INACTIVE_MESSAGE,
      };
    }

    if (input.memberRole === 'student') {
      const studentQuota = normalizeStudentQuota(org.student_quota);
      const { count: seatsUsed, error: countError } = await client
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('org_role', 'student')
        .eq('is_active', true);

      if (countError) {
        console.error('[join-org] Öğrenci kota sayımı:', countError.message);
        return {
          success: false,
          message: 'Kurum kotası doğrulanamadı. Lütfen tekrar deneyin.',
        };
      }

      const usedSeats = seatsUsed ?? 0;
      if (isStudentQuotaExceeded(usedSeats, studentQuota)) {
        return {
          success: false,
          message: ORG_JOIN_QUOTA_FULL_MESSAGE,
        };
      }
    }

    if (input.memberRole === 'teacher') {
      const teacherQuota = resolveTeacherQuota(
        org.teacher_quota ?? null,
        org.student_quota,
      );
      const { count: teachersUsed, error: teacherCountError } = await client
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('org_role', 'teacher')
        .eq('is_active', true);

      if (teacherCountError) {
        console.error(
          '[join-org] Öğretmen kota sayımı:',
          teacherCountError.message,
        );
        return {
          success: false,
          message: 'Öğretmen kotası doğrulanamadı. Lütfen tekrar deneyin.',
        };
      }

      const usedTeachers = teachersUsed ?? 0;
      if (usedTeachers >= teacherQuota) {
        return {
          success: false,
          message: orgJoinTeacherQuotaFullMessage(usedTeachers, teacherQuota),
        };
      }
    }

    const { error: insertError } = await client.from('organization_members').insert({
      organization_id: org.id,
      branch_id: null,
      user_id: userId,
      org_role: input.memberRole,
      is_active: true,
    });

    if (insertError) {
      console.error('[join-org] Kuruma katılım:', insertError.message);
      if (insertError.code === '23505') {
        return {
          success: true,
          message: `${org.name} kurumuna zaten kayıtlısın.`,
          orgName: org.name,
        };
      }
      return { success: false, message: 'Kuruma bağlanılamadı.' };
    }

    if (input.memberRole === 'student') {
      revalidatePath(STUDENT_DASHBOARD_PATH);
      revalidatePath(STUDENT_CONNECTIONS_PATH);
    } else {
      revalidatePath(TEACHER_DASHBOARD_PATH);
      revalidatePath('/coordinator');
    }

    return {
      success: true,
      message: `${org.name} kurumuna başarıyla bağlandın.`,
      orgName: org.name,
    };
  } catch (error) {
    console.error(
      '[join-org] joinOrganizationWithCodeAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, message: 'Beklenmeyen bir hata oluştu.' };
  }
}
