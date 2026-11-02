import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Çerezli (oturumlu) sunucu istemcisi.
 *
 * `getSupabaseAdmin()` service role kullanır ve RLS'i baypas eder; bu istemci
 * ise oturum çerezleriyle çalışır ve RLS'e tabidir. Service role anahtarı
 * tanımlı değilse son çare olarak bu kullanılır.
 *
 * `@param schema` Postgres şeması. Varsayılan `public`.
 * Yapılandırma eksikse `null` döner.
 */
export async function getSupabaseServer(
  schema = 'public',
): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  try {
    const cookieStore = await cookies();

    return createServerClient(url, anonKey, {
      db: { schema: schema as 'public' },
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
  } catch (error) {
    console.error(
      '[supabase] SSR istemcisi oluşturulamadı:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
