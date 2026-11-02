import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
/**
 * Çerezdeki Supabase oturumunu sunucuda okur.
 *
 * ANON anahtarı kullanılır (service role DEĞİL): bu istemci yalnızca kimliği
 * doğrulamak için var. Veri yazma/okuma işleri service role istemcisiyle yapılır.
 *
 * Oturum yoksa veya yapılandırma eksikse `null` döner; çağıran taraf anonim
 * akışa düşer. Bu, geriye dönük uyumluluğun temelidir.
 */
export async function getSessionUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Route Handler içinde çerez yazımı her zaman mümkün olmayabilir;
          // kimlik doğrulama için okuma yeterli olduğundan hata yutulur.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Sunucu bileşeni bağlamında yazma başarısız olabilir; yoksay.
          }
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }

    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

/**
 * `profiles` şeması. Admin kontrolü ve kullanıcı listesi için ortak tip.
 * Tablo `public` şemasında tutulur.
 */
export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'teacher' | 'student';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string | null;
}

/**
 * Acil durum admin fallback'i.
 *
 * NEDEN VAR: Profil tablosu RLS/şema sorunları yüzünden boş dönse bile
 * yönetici hesabının kendini kilitlemesi kabul edilemez. Bu adres sabittir
 * ve yalnızca profil kaydı okunamadığında devreye girer.
 */
const EMERGENCY_ADMIN_EMAIL = 'master@360bct.com';

/**
 * Oturumdaki kullanıcıyı ve profilini birlikte döner.
 *
 * OKUMA STRATEJİSİ:
 * 1. Önce service role istemcisiyle okunur. `profiles` tablosunda
 *    `authenticated` rolü için SELECT politikası bulunmadığından, oturumlu
 *    anon istemci 0 satır görüyor ve admin kendini kilitliyordu.
 * 2. Service role yapılandırılmamışsa oturumlu istemciyle denenir.
 * 3. Profil hâlâ okunamıyorsa ve kullanıcı acil durum admin adresiyse,
 *    kilitlenmeyi önlemek için sentetik bir admin profili döner.
 */
export async function getCurrentProfile(): Promise<{
  user: { id: string; email: string | null };
  profile: ProfileRecord;
  /** Profil veritabanından mı geldi, yoksa fallback mi kullanıldı? */
  source: 'database' | 'fallback';
} | null> {
  const user = await getSessionUser();
  if (!user) {
    console.log('[auth] profile check: oturum yok');
    return null;
  }

  const adminClient = getSupabaseAdmin(PROFILES_SCHEMA);
  let profile: ProfileRecord | null = null;
  let readError: string | null = null;

  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, status, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        readError = `${error.code ?? '?'}: ${error.message}`;
      } else if (data) {
        profile = data as ProfileRecord;
      }
    } catch (error) {
      readError = error instanceof Error ? error.message : String(error);
    }
  } else {
    readError = 'service role istemcisi yok';
  }

  // Service role başarısızsa oturumlu istemciyle bir kez daha dene.
  if (!profile) {
    const sessionProfile = await readProfileWithSession(user.id);
    if (sessionProfile) {
      profile = sessionProfile;
    }
  }

  console.log(
    '[auth] profile check:',
    user.email,
    profile?.role,
    profile?.status,
    readError ? `(okuma: ${readError})` : '',
  );

  if (profile) {
    return { user, profile, source: 'database' };
  }

  /*
   * ACİL DURUM: Profil okunamadı. Yönetici hesabı kilitlenmemeli.
   * Bu yalnızca bilinen admin adresi için geçerlidir ve loglanır.
   */
  if (user.email === EMERGENCY_ADMIN_EMAIL) {
    console.warn(
      '[auth] ACİL DURUM FALLBACK: profil okunamadı, admin olarak kabul ediliyor:',
      user.email,
    );
    return {
      user,
      source: 'fallback',
      profile: {
        id: user.id,
        email: user.email,
        full_name: null,
        role: 'admin',
        status: 'approved',
        /*
         * Sabit bir placeholder kullanılıyor: `new Date()` prerender sırasında
         * "unstable value" hatası üretiyor. Bu alan yalnızca görüntüleme içindir
         * ve fallback profili gerçek bir kayda karşılık gelmez.
         */
        created_at: '',
        updated_at: null,
      },
    };
  }

  return null;
}

/** Oturumlu (RLS'e tabi) istemciyle profil okuma denemesi. */
async function readProfileWithSession(
  userId: string,
): Promise<ProfileRecord | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(url, anonKey, {
      db: { schema: PROFILES_SCHEMA },
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
            // Server Component bağlamında yazma başarısız olabilir; yoksay.
          }
        },
      },
    });

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.log(
        '[auth] oturumlu profil okuma hatası:',
        error.code,
        error.message,
      );
      return null;
    }

    return data ? (data as ProfileRecord) : null;
  } catch (error) {
    console.log(
      '[auth] oturumlu profil okuma istisnası:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
