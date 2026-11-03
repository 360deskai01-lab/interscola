'use server';

import { revalidatePath } from 'next/cache';
import { randomInt } from 'node:crypto';
import { getCurrentProfile, type ProfileRecord } from '@/lib/auth';
import {
  loadStudentAnalyticsData,
  type StudentAnalyticsData,
} from '@/lib/student-analytics';
import type { StudentCareerInsightForTeacher } from '@/lib/student-dashboard/teacher-career-insight';
import { loadTeacherStudentCareerInsight } from '@/lib/teacher-dashboard/load-student-career';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

/** Sunucu action'larının ortak dönüş biçimi. */
export interface TeacherActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

/** Öğretmene bağlı aktif öğrenci. */
export interface TeacherStudent {
  /** `student_teachers` kaydının id'si (bağlantıyı koparmak için gerekli). */
  linkId: string;
  studentId: string;
  fullName: string;
  email: string;
  /** `user_metadata.selected_curriculums` alanından gelir. */
  curriculums: string[];
  status: string;
  linkedAt: string;
}

/** Henüz kullanılmamış davet kodu. */
export interface TeacherInvite {
  id: string;
  inviteCode: string;
  createdAt: string;
}

/** Öğretmen panelinin tek seferde ihtiyaç duyduğu veri. */
export interface TeacherDashboardData {
  students: TeacherStudent[];
  invites: TeacherInvite[];
  totalAttempts: number;
}

type StudentTeacherRow = {
  id: string;
  teacher_id: string;
  student_id: string | null;
  invite_code: string;
  status: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Davet kodu üretimi
// ---------------------------------------------------------------------------

const INVITE_PREFIX = 'INT-';
/** Önek 4 karakter olduğu için 4 rastgele karakterle toplam 8 haneye tamamlanır. */
const INVITE_RANDOM_LENGTH = 4;
/**
 * Karıştırılabilecek karakterler (0/O, 1/I/L) çıkarıldı: kod telefonda
 * okunacak veya elle yazılacak, yanlış anlaşılma payı düşük olmalı.
 */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateInviteCode(): string {
  let suffix = '';
  for (let i = 0; i < INVITE_RANDOM_LENGTH; i += 1) {
    // `randomInt` kriptografik olarak güvenli ve modulo yanlılığı yok.
    suffix += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return `${INVITE_PREFIX}${suffix}`;
}

// ---------------------------------------------------------------------------
// Yetki yardımcıları
// ---------------------------------------------------------------------------

/**
 * Çağıranın onaylı bir öğretmen olduğunu doğrular.
 * Admin de öğretmen işlevlerini kullanabilsin diye iki rol de kabul edilir.
 */
async function requireApprovedTeacher(): Promise<ProfileRecord | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.status !== 'approved') return null;
  if (current.profile.role !== 'teacher' && current.profile.role !== 'admin') {
    return null;
  }
  return current.profile;
}

/**
 * Varsa service role istemcisi, yoksa çerezli SSR istemcisi.
 * `profiles` tablosu `public` şemasında olduğu için şema açıkça verilir.
 */
async function getProfilesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

// ---------------------------------------------------------------------------
// Kurumsal (B2B) bağlam
// ---------------------------------------------------------------------------

/** Öğretmenin kurum/şube üyeliği (yoksa panel bireysel kalır). */
export interface TeacherOrganizationContext {
  organizationName: string;
  branchName: string | null;
  orgRole: string;
  orgRoleLabel: string;
}

const ORG_ROLE_LABELS: Record<string, string> = {
  org_admin: 'Kurum Yöneticisi',
  coordinator: 'Koordinatör',
  teacher: 'Öğretmen',
  student: 'Öğrenci',
};

function orgRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Üye';
  return ORG_ROLE_LABELS[role] ?? role;
}

/**
 * Onaylı öğretmenin aktif kurum üyeliğini döner (en güncel kayıt).
 */
export async function getTeacherOrganizationContextAction(): Promise<{
  success: boolean;
  error?: string;
  context: TeacherOrganizationContext | null;
}> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Kurum bilgisi için onaylı öğretmen oturumu gerekiyor.',
        context: null,
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return {
        success: false,
        error: 'Veritabanı bağlantısı kurulamadı.',
        context: null,
      };
    }

    const { data, error } = await client
      .from('organization_members')
      .select(
        `
        org_role,
        organizations ( name ),
        branches ( name )
      `,
      )
      .eq('user_id', teacher.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[teacher] Kurum bağlamı okunamadı:', error.message);
      return {
        success: false,
        error: 'Kurum bilgisi okunamadı.',
        context: null,
      };
    }

    if (!data) {
      return { success: true, context: null };
    }

    type MemberRow = {
      org_role: string | null;
      organizations:
        | { name: string }
        | { name: string }[]
        | null;
      branches: { name: string } | { name: string }[] | null;
    };

    const row = data as MemberRow;
    const orgRaw = row.organizations;
    const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
    const branchRaw = row.branches;
    const branch = Array.isArray(branchRaw) ? branchRaw[0] : branchRaw;

    if (!org?.name) {
      return { success: true, context: null };
    }

    const orgRole = row.org_role ?? 'teacher';

    return {
      success: true,
      context: {
        organizationName: org.name,
        branchName: branch?.name ?? null,
        orgRole,
        orgRoleLabel: orgRoleLabel(orgRole),
      },
    };
  } catch (error) {
    console.error(
      '[teacher] getTeacherOrganizationContextAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return {
      success: false,
      error: 'Kurum bilgisi yüklenemedi.',
      context: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Davet kodu oluşturma
// ---------------------------------------------------------------------------

/**
 * Onaylı öğretmen için yeni bir davet kodu üretir.
 *
 * Kodun benzersizliği veritabanında kontrol edilir; çakışma olursa
 * birkaç kez yeniden denenir. Bu kontrol olmadan `invite_code` üzerindeki
 * unique kısıtı insert'i patlatırdı.
 */
export async function createInviteCodeAction(): Promise<
  TeacherActionResult<TeacherInvite>
> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğretmen hesabı gerekiyor.',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const inviteCode = generateInviteCode();

      // Kod daha önce üretilmiş mi? (kullanılmış olsa bile tekrar edilmemeli)
      const { data: existing, error: checkError } = await client
        .from('student_teachers')
        .select('id')
        .eq('invite_code', inviteCode)
        .maybeSingle();

      if (checkError) {
        console.error(
          '[teacher] Davet kodu kontrolü başarısız:',
          checkError.message,
        );
        return { success: false, error: 'Davet kodu oluşturulamadı.' };
      }

      if (existing) {
        continue; // çakışma: yeni kod dene
      }

      const { data: inserted, error: insertError } = await client
        .from('student_teachers')
        .insert({
          teacher_id: teacher.id,
          student_id: null,
          invite_code: inviteCode,
          status: 'pending',
        })
        .select('id, invite_code, created_at')
        .single();

      if (insertError) {
        console.error('[teacher] Davet kodu yazılamadı:', insertError.message);
        // Benzersizlik ihlali ise yeni kodla tekrar dene.
        if (insertError.code === '23505') continue;
        return { success: false, error: 'Davet kodu kaydedilemedi.' };
      }

      const row = inserted as {
        id: string;
        invite_code: string;
        created_at: string;
      };

      revalidatePath('/teacher/dashboard');

      return {
        success: true,
        data: {
          id: row.id,
          inviteCode: row.invite_code,
          createdAt: row.created_at,
        },
      };
    }

    return {
      success: false,
      error: 'Benzersiz kod üretilemedi, lütfen tekrar dene.',
    };
  } catch (error) {
    console.error(
      '[teacher] createInviteCodeAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

// ---------------------------------------------------------------------------
// Panel verisi
// ---------------------------------------------------------------------------

/**
 * Öğretmenin bağlı öğrencilerini, bekleyen davetlerini ve öğrencilerinin
 * çözdüğü toplam deneme sayısını döner.
 */
export async function getTeacherStudentsAction(): Promise<
  TeacherActionResult<TeacherDashboardData>
> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu veriyi görüntülemek için onaylı öğretmen hesabı gerekiyor.',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: links, error: linkError } = await client
      .from('student_teachers')
      .select('id, teacher_id, student_id, invite_code, status, created_at')
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false });

    if (linkError) {
      console.error('[teacher] Bağlantılar okunamadı:', linkError.message);
      return { success: false, error: 'Öğrenci listesi okunamadı.' };
    }

    const rows = (links ?? []) as StudentTeacherRow[];

    const activeRows = rows.filter(
      (row) => row.status === 'active' && row.student_id !== null,
    );
    const pendingRows = rows.filter(
      (row) => row.status === 'pending' && row.student_id === null,
    );

    const studentIds = activeRows
      .map((row) => row.student_id)
      .filter((id): id is string => typeof id === 'string');

    // Profil bilgileri tek sorguda alınır.
    const profileById = new Map<
      string,
      { full_name: string | null; email: string }
    >();

    if (studentIds.length > 0) {
      const { data: profiles, error: profileError } = await client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);

      if (profileError) {
        console.error(
          '[teacher] Öğrenci profilleri okunamadı:',
          profileError.message,
        );
      } else {
        for (const profile of profiles ?? []) {
          const row = profile as {
            id: string;
            full_name: string | null;
            email: string;
          };
          profileById.set(row.id, {
            full_name: row.full_name,
            email: row.email,
          });
        }
      }
    }

    /*
     * Hedef sınavlar `profiles` tablosunda DEĞİL, kayıt sırasında
     * `auth.users.user_metadata.selected_curriculums` alanına yazılıyor.
     * Bu yüzden Auth admin API'sinden okunur; profil tablosunda böyle bir
     * kolon yok.
     */
    const curriculumById = new Map<string, string[]>();
    const adminForAuth = getSupabaseAdmin(PROFILES_SCHEMA);

    if (adminForAuth && studentIds.length > 0) {
      await Promise.all(
        studentIds.map(async (studentId) => {
          try {
            const { data, error } = await adminForAuth.auth.admin.getUserById(
              studentId,
            );
            if (error || !data.user) return;
            const raw = data.user.user_metadata?.selected_curriculums;
            if (Array.isArray(raw)) {
              curriculumById.set(
                studentId,
                raw.filter((item): item is string => typeof item === 'string'),
              );
            }
          } catch {
            // Tek bir öğrencinin metadata'sı okunamazsa liste bozulmasın.
          }
        }),
      );
    }

    const students: TeacherStudent[] = activeRows.map((row) => {
      const studentId = row.student_id ?? '';
      const profile = profileById.get(studentId);
      return {
        linkId: row.id,
        studentId,
        fullName: profile?.full_name ?? 'İsimsiz öğrenci',
        email: profile?.email ?? '—',
        curriculums: curriculumById.get(studentId) ?? [],
        status: row.status,
        linkedAt: row.created_at,
      };
    });

    const invites: TeacherInvite[] = pendingRows.map((row) => ({
      id: row.id,
      inviteCode: row.invite_code,
      createdAt: row.created_at,
    }));

    // Öğrencilerin çözdüğü toplam deneme: `interscola` şemasında.
    let totalAttempts = 0;
    const attemptsClient = getSupabaseAdmin('interscola');

    if (attemptsClient && studentIds.length > 0) {
      try {
        const { count, error } = await attemptsClient
          .from('assessment_attempts')
          .select('id', { count: 'exact', head: true })
          .in('student_id', studentIds);

        if (error) {
          console.error(
            '[teacher] Deneme sayısı okunamadı:',
            error.message,
          );
        } else {
          totalAttempts = count ?? 0;
        }
      } catch (error) {
        console.error(
          '[teacher] Deneme sayısı hatası:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return {
      success: true,
      data: { students, invites, totalAttempts },
    };
  } catch (error) {
    console.error(
      '[teacher] getTeacherStudentsAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Öğrenci listesi yüklenemedi.' };
  }
}

/**
 * Paneldeki "Yeni davet kodu üret" butonu için form-action köprüsü.
 * Client bileşene devredilirken yalnızca gerekli alanlar döner.
 */
export async function createInviteFormAction(): Promise<{
  success: boolean;
  error?: string;
  inviteCode?: string;
}> {
  const result = await createInviteCodeAction();
  return {
    success: result.success,
    error: result.error,
    inviteCode: result.data?.inviteCode,
  };
}

/**
 * Paneldeki "Bağlantıyı kaldır" butonu için form-action köprüsü.
 */
export async function removeStudentFormAction(
  linkId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await removeStudentAction(linkId);
  return { success: result.success, error: result.error };
}

// ---------------------------------------------------------------------------
// Bağlantı koparma
// ---------------------------------------------------------------------------

/**
 * Öğretmenin bir öğrenci bağlantısını koparmasını sağlar.
 *
 * Kayıt silinmez, `status = 'removed'` yapılır: geçmiş denemeler ve
 * denetim izi korunur.
 */
export async function removeStudentAction(
  studentTeacherId: string,
): Promise<TeacherActionResult> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğretmen hesabı gerekiyor.',
      };
    }

    if (
      typeof studentTeacherId !== 'string' ||
      studentTeacherId.trim().length === 0
    ) {
      return { success: false, error: 'Geçersiz bağlantı kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    /*
     * Sahiplik kontrolü: öğretmen yalnızca KENDİ bağlantısını koparabilir.
     * `teacher_id` filtresi olmadan başka bir öğretmenin öğrencisi de
     * silinebilirdi.
     */
    const { data: target, error: targetError } = await client
      .from('student_teachers')
      .select('id, teacher_id')
      .eq('id', studentTeacherId)
      .maybeSingle();

    if (targetError) {
      console.error('[teacher] Bağlantı okunamadı:', targetError.message);
      return { success: false, error: 'Bağlantı bulunamadı.' };
    }

    if (!target) {
      return { success: false, error: 'Bağlantı bulunamadı.' };
    }

    if ((target as { teacher_id: string }).teacher_id !== teacher.id) {
      console.warn(
        '[teacher] Yetkisiz bağlantı koparma denemesi:',
        teacher.email,
        '->',
        studentTeacherId,
      );
      return { success: false, error: 'Bu bağlantı size ait değil.' };
    }

    const { error: updateError } = await client
      .from('student_teachers')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', studentTeacherId);

    if (updateError) {
      console.error(
        '[teacher] Bağlantı koparılamadı:',
        updateError.message,
      );
      return { success: false, error: 'Bağlantı koparılamadı.' };
    }

    revalidatePath('/teacher/dashboard');
    return { success: true };
  } catch (error) {
    console.error(
      '[teacher] removeStudentAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

// ---------------------------------------------------------------------------
// Öğrenci gelişim analitiği (FAZ 4.2)
// ---------------------------------------------------------------------------

const STUDENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Bağlı bir öğrencinin sınav deneme geçmişi ve öğrenme boşlukları (öğretmen görünümü).
 */
export async function getStudentAnalyticsForTeacherAction(
  studentId: string,
): Promise<TeacherActionResult<StudentAnalyticsData>> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu veri için onaylı bir öğretmen hesabı gerekiyor.',
      };
    }

    const trimmed = studentId.trim();
    if (!STUDENT_UUID_PATTERN.test(trimmed)) {
      return { success: false, error: 'Geçersiz öğrenci kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: link, error: linkError } = await client
      .from('student_teachers')
      .select('id')
      .eq('teacher_id', teacher.id)
      .eq('student_id', trimmed)
      .eq('status', 'active')
      .maybeSingle();

    if (linkError) {
      console.error('[teacher] Analitik bağlantı doğrulanamadı:', linkError.message);
      return { success: false, error: 'Öğrenci bağlantısı doğrulanamadı.' };
    }

    if (!link) {
      return {
        success: false,
        error: 'Bu öğrenci ile aktif bir bağlantınız yok.',
      };
    }

    const loaded = await loadStudentAnalyticsData(trimmed);
    if (!loaded.ok) {
      return { success: false, error: loaded.error };
    }

    return { success: true, data: loaded.data };
  } catch (error) {
    console.error(
      '[teacher] getStudentAnalyticsForTeacherAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Öğrenci analitiği yüklenemedi.' };
  }
}

export async function getStudentAnalyticsForTeacherFormAction(
  studentId: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: StudentAnalyticsData;
}> {
  const result = await getStudentAnalyticsForTeacherAction(studentId);
  return {
    success: result.success,
    error: result.error,
    data: result.data,
  };
}

// ---------------------------------------------------------------------------
// Öğrenci kariyer & yetkinlik özeti (Kariyer Pusulası)
// ---------------------------------------------------------------------------

export type { StudentCareerInsightForTeacher } from '@/lib/student-dashboard/teacher-career-insight';

async function verifyTeacherStudentLink(
  teacherId: string,
  studentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = studentId.trim();
  if (!STUDENT_UUID_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Geçersiz öğrenci kimliği.' };
  }

  const client = await getProfilesClient();
  if (!client) {
    return { ok: false, error: 'Veritabanı bağlantısı kurulamadı.' };
  }

  const { data: link, error: linkError } = await client
    .from('student_teachers')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('student_id', trimmed)
    .eq('status', 'active')
    .maybeSingle();

  if (linkError) {
    console.error('[teacher] Kariyer bağlantı doğrulanamadı:', linkError.message);
    return { ok: false, error: 'Öğrenci bağlantısı doğrulanamadı.' };
  }

  if (!link) {
    return {
      ok: false,
      error: 'Bu öğrenci ile aktif bir bağlantınız yok.',
    };
  }

  return { ok: true };
}

export async function getStudentCareerInsightForTeacherAction(
  studentId: string,
  studentName?: string,
): Promise<TeacherActionResult<StudentCareerInsightForTeacher>> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu veri için onaylı bir öğretmen hesabı gerekiyor.',
      };
    }

    const link = await verifyTeacherStudentLink(teacher.id, studentId);
    if (!link.ok) {
      return { success: false, error: link.error };
    }

    const data = await loadTeacherStudentCareerInsight(
      studentId.trim(),
      studentName,
    );

    return { success: true, data };
  } catch (error) {
    console.error(
      '[teacher] getStudentCareerInsightForTeacherAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Kariyer özeti yüklenemedi.' };
  }
}

export async function getStudentCareerInsightForTeacherFormAction(
  studentId: string,
  studentName?: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: StudentCareerInsightForTeacher;
}> {
  const result = await getStudentCareerInsightForTeacherAction(
    studentId,
    studentName,
  );
  return {
    success: result.success,
    error: result.error,
    data: result.data,
  };
}
