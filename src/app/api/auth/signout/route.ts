import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Oturumu kapatır ve Supabase çerezlerini temizler.
 * Oturum yoksa da başarı döner: işlem idempotent.
 */
export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({ success: true });
  }

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
            // Yazma başarısız olsa da çıkış isteği başarısız sayılmaz.
          }
        },
      },
    });

    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      '[auth] Çıkış sırasında hata:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
