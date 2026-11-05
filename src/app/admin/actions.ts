'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  getCurrentProfile,
  type ProfileRecord,
} from '@/lib/auth';
import { PROFILES_SCHEMA, getSupabaseAdmin } from '@/lib/supabase';

/**
 * Server Action sonuç tipi. `error` yalnızca başarısızlıkta doludur.
 * Başarı durumunda `userId` ve `newStatus` döner: client bileşen bunlarla
 * optimistic UI güncellemesi yapabilsin.
 */
export interface AdminActionResult {
  success: boolean;
  error?: string;
  userId?: string;
  newStatus?: 'approved' | 'rejected';
}

export interface AdminPasswordResetResult {
  success: boolean;
  message?: string;
  error?: string;
}

const ADMIN_PASSWORD_MIN_LENGTH = 6;

const DASHBOARD_PATH = '/admin/dashboard';

/** UUID biçim kontrolü: geçersiz id ile sorgu atmadan önce eleme. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Çağıranın gerçekten admin + approved olduğunu doğrular.
 * Yetkisizse `null` döner; çağıran taraf hata üretir.
 */
export async function requireApprovedAdmin(): Promise<ProfileRecord | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'admin') return null;
  if (current.profile.status !== 'approved') return null;
  return current.profile;
}

/**
 * Hedef kullanıcının durumunu günceller.
 *
 * Güvenlik kuralları:
 * - Yalnızca admin + approved çağırabilir.
 * - Admin kendi durumunu değiştiremez (kendini kilitleme koruması).
 * - `admin` rolündeki başka bir kullanıcı da hedef alınamaz.
 *
 * NOT: Yazma işlemi service role istemcisiyle yapılır. `profiles` tablosunun
 * RLS politikaları anon/oturumlu yazmayı garanti etmediği için oturumlu
 * istemci kullanmak "sessizce 0 satır güncelleme" riski taşıyordu.
 */
export async function updateUserStatus(
  userId: string,
  newStatus: 'approved' | 'rejected',
): Promise<AdminActionResult> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return {
        success: false,
        error: 'Bu işlem için yetkiniz yok.',
      };
    }

    if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
      return { success: false, error: 'Geçersiz kullanıcı kimliği.' };
    }

    if (newStatus !== 'approved' && newStatus !== 'rejected') {
      return { success: false, error: 'Geçersiz durum değeri.' };
    }

    if (userId === admin.id) {
      return {
        success: false,
        error: 'Kendi hesabınızın durumunu değiştiremezsiniz.',
      };
    }

    const supabase = getSupabaseAdmin(PROFILES_SCHEMA);
    if (!supabase) {
      return {
        success: false,
        error: 'Veritabanı yapılandırması eksik (service role).',
      };
    }

    // Hedefin admin olmadığını doğrula: admin hesapları bu panelden yönetilmez.
    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (targetError) {
      console.error(
        '[admin] Hedef kullanıcı okunamadı:',
        targetError.message,
      );
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    if (!target) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    if ((target as { role: string }).role === 'admin') {
      return {
        success: false,
        error: 'Yönetici hesapları bu panelden değiştirilemez.',
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, status')
      .maybeSingle();

    if (updateError) {
      console.error('[admin] Durum güncellenemedi:', updateError.message);
      return { success: false, error: 'Durum güncellenemedi.' };
    }

    /*
     * Service role ile yazdığımızda bile 0 satır dönebilir. Bunu sessiz
     * başarı olarak raporlamak kullanıcıya yalan söylemek olurdu.
     */
    if (!updated) {
      console.error(
        '[admin] Güncelleme 0 satır etkiledi. Hedef:',
        userId,
      );
      return {
        success: false,
        error: 'Güncelleme uygulanmadı (kullanıcı bulunamadı veya değişmedi).',
      };
    }

    revalidatePath(DASHBOARD_PATH);
    return { success: true, userId, newStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin] updateUserStatus beklenmeyen hata:', message);
    return { success: false, error: message };
  }
}

/**
 * Master admin: hedef öğrenci/öğretmen auth şifresini service role ile günceller.
 */
export async function adminResetUserPasswordAction(
  targetUserId: string,
  newPassword: string,
): Promise<AdminPasswordResetResult> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      throw new Error('Bu işlem için master admin yetkisi gerekiyor.');
    }

    if (typeof targetUserId !== 'string' || !UUID_PATTERN.test(targetUserId)) {
      throw new Error('Geçersiz kullanıcı kimliği.');
    }

    if (typeof newPassword !== 'string') {
      throw new Error('Geçersiz şifre.');
    }

    const trimmedPassword = newPassword.trim();
    if (trimmedPassword.length < ADMIN_PASSWORD_MIN_LENGTH) {
      throw new Error(
        `Şifre en az ${ADMIN_PASSWORD_MIN_LENGTH} karakter olmalıdır.`,
      );
    }

    if (targetUserId === admin.id) {
      throw new Error(
        'Kendi şifrenizi bu panelden değiştirmek için profil ayarlarını kullanın.',
      );
    }

    const supabase = getSupabaseAdmin(PROFILES_SCHEMA);
    if (!supabase) {
      throw new Error(
        'Veritabanı yapılandırması eksik (SUPABASE_SERVICE_ROLE_KEY).',
      );
    }

    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetError || !target) {
      throw new Error('Kullanıcı bulunamadı.');
    }

    const role = (target as { role: string }).role;
    if (role === 'admin') {
      throw new Error('Yönetici hesaplarının şifresi bu panelden değiştirilemez.');
    }
    if (role !== 'student' && role !== 'teacher') {
      throw new Error('Yalnızca öğrenci ve öğretmen şifreleri güncellenebilir.');
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { password: trimmedPassword },
    );

    if (authError) {
      console.error('[admin] Şifre güncellenemedi:', authError.message);
      throw new Error(
        authError.message || 'Auth şifresi güncellenemedi.',
      );
    }

    return {
      success: true,
      message: 'Kullanıcı şifresi başarıyla güncellendi.',
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu.';
    console.error('[admin] adminResetUserPasswordAction:', message);
    return { success: false, error: message };
  }
}

/**
 * Admin oturumunu kapatır ve giriş sayfasına yönlendirir.
 * `redirect()` çağrısı hata fırlattığı için try/catch dışında tutulur.
 */
export async function signOutAdmin(): Promise<void> {
  try {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      const cookieStore = await cookies();
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              for (const { name, value, options } of cookiesToSet) {
                cookieStore.set(name, value, options);
              }
            } catch {
              // Çıkışta çerez silme başarısız olsa da yönlendirme yapılır.
            }
          },
        },
      });

      await supabase.auth.signOut();
    }
  } catch (error) {
    console.error(
      '[admin] Çıkış sırasında hata:',
      error instanceof Error ? error.message : error,
    );
  }

  redirect('/auth/login');
}

// ---------------------------------------------------------------------------
// Client bileşen köprüleri
// ---------------------------------------------------------------------------

/*
 * Arayüz artık `<form action={...}>` yerine `useTransition` ile doğrudan
 * çağrı yapıyor. Bu, Next.js'in form submit sırasında tüm sayfayı yeniden
 * render etmesini (ve "Rendering..." takılmasını) önler.
 *
 * Bu iki fonksiyon `<form action>` ile de kullanılabilir; ancak önerilen yol
 * client bileşenden çağırmaktır.
 */

/** Onaylama için client köprüsü. Sonuç nesnesi aynen döner. */
export async function approveUserAction(
  userId: string,
): Promise<AdminActionResult> {
  return updateUserStatus(userId, 'approved');
}

/** Reddetme için client köprüsü. Sonuç nesnesi aynen döner. */
export async function rejectUserAction(
  userId: string,
): Promise<AdminActionResult> {
  return updateUserStatus(userId, 'rejected');
}

/** Formdan gelen `userId` alanını okuyup onaylar (form action uyumluluğu). */
export async function approveUser(formData: FormData): Promise<void> {
  const userId = formData.get('userId');
  if (typeof userId !== 'string' || !userId) return;
  const result = await updateUserStatus(userId, 'approved');
  if (!result.success) {
    console.error('[admin] Onaylama başarısız:', result.error);
  }
}

/** Formdan gelen `userId` alanını okuyup reddeder (form action uyumluluğu). */
export async function rejectUser(formData: FormData): Promise<void> {
  const userId = formData.get('userId');
  if (typeof userId !== 'string' || !userId) return;
  const result = await updateUserStatus(userId, 'rejected');
  if (!result.success) {
    console.error('[admin] Reddetme başarısız:', result.error);
  }
}
