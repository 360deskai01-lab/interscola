'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/** Platform geneli güvenli çıkış — oturum çerezlerini temizler. */
export async function signOutAction(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && anonKey) {
    try {
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
              /* Server Component bağlamında yazma başarısız olabilir */
            }
          },
        },
      });
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        '[auth] signOutAction hatası:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  redirect('/');
}
