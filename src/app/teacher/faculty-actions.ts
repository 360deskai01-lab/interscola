'use server';

import { getCurrentProfile } from '@/lib/auth';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface FacultyColleague {
  teacherId: string;
  fullName: string;
  email: string;
  /** `profiles.teaching_expertise`; yoksa boş. */
  expertise: string | null;
}

export type FacultyActionResult<T = undefined> = {
  success: boolean;
  error?: string;
  data?: T;
};

async function getProfilesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

async function requireApprovedTeacher() {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.status !== 'approved') return null;
  if (current.profile.role !== 'teacher' && current.profile.role !== 'admin') {
    return null;
  }
  return current;
}

/**
 * Aynı öğrenciye bağlı diğer onaylı öğretmenler (mevcut öğretmen hariç).
 */
export async function getStudentFacultyAction(
  studentId: string,
): Promise<FacultyActionResult<FacultyColleague[]>> {
  try {
    const current = await requireApprovedTeacher();
    if (!current) {
      return {
        success: false,
        error: 'Bu veri için onaylı öğretmen hesabı gerekiyor.',
      };
    }

    if (!UUID_PATTERN.test(studentId)) {
      return { success: false, error: 'Geçersiz öğrenci kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: ownLink, error: ownErr } = await client
      .from('student_teachers')
      .select('id')
      .eq('teacher_id', current.user.id)
      .eq('student_id', studentId)
      .eq('status', 'active')
      .maybeSingle();

    if (ownErr) {
      console.error('[faculty] Bağlantı doğrulanamadı:', ownErr.message);
      return { success: false, error: 'Öğrenci bağlantısı doğrulanamadı.' };
    }

    if (!ownLink) {
      return {
        success: false,
        error: 'Bu öğrenci sizin aktif listenizde değil.',
      };
    }

    const { data: links, error: linkErr } = await client
      .from('student_teachers')
      .select('teacher_id')
      .eq('student_id', studentId)
      .eq('status', 'active');

    if (linkErr) {
      console.error('[faculty] Ortak eğitmenler okunamadı:', linkErr.message);
      return { success: false, error: 'Ortak eğitmen listesi okunamadı.' };
    }

    const colleagueIds = [
      ...new Set(
        ((links ?? []) as { teacher_id: string }[])
          .map((r) => r.teacher_id)
          .filter(
            (id): id is string =>
              typeof id === 'string' && id !== current.user.id,
          ),
      ),
    ];

    if (colleagueIds.length === 0) {
      return { success: true, data: [] };
    }

    let profilesRaw: unknown = null;
    let profileErr = null;

    let q = await client
      .from('profiles')
      .select('id, full_name, email, teaching_expertise')
      .in('id', colleagueIds)
      .in('role', ['teacher', 'admin']);

    profilesRaw = q.data;
    profileErr = q.error;

    if (profileErr?.code === '42703') {
      const fb = await client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', colleagueIds)
        .in('role', ['teacher', 'admin']);
      profilesRaw = fb.data;
      profileErr = fb.error;
    }

    if (profileErr) {
      console.error('[faculty] Profiller okunamadı:', profileErr.message);
      return { success: false, error: 'Eğitmen profilleri okunamadı.' };
    }

    const data: FacultyColleague[] = ((profilesRaw ?? []) as {
      id: string;
      full_name: string | null;
      email: string;
      teaching_expertise?: string | null;
    }[]).map((p) => ({
      teacherId: p.id,
      fullName: p.full_name?.trim() || p.email || 'İsimsiz eğitmen',
      email: p.email,
      expertise:
        typeof p.teaching_expertise === 'string' && p.teaching_expertise.trim()
          ? p.teaching_expertise.trim()
          : null,
    }));

    return { success: true, data };
  } catch (error) {
    console.error(
      '[faculty] getStudentFacultyAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Ortak eğitmenler yüklenemedi.' };
  }
}

export async function getStudentFacultyFormAction(studentId: string): Promise<{
  success: boolean;
  error?: string;
  data?: FacultyColleague[];
}> {
  const result = await getStudentFacultyAction(studentId);
  return {
    success: result.success,
    error: result.error,
    data: result.data,
  };
}
