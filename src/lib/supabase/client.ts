'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Tarayıcı tarafı Supabase istemcisi.
 *
 * NEDEN `@supabase/ssr`: oturum `localStorage` yerine ÇEREZLERE yazılır.
 * Sunucudaki `getSessionUser()` oturumu yalnızca çerezden okuyabildiği için
 * kullanıcı izolasyonu (`student_id`) buna bağlıdır. Düz `createClient`
 * kullanılsaydı giriş yapılmış görünür ama sunucu tarafı kullanıcıyı tanımaz,
 * tüm denemeler anonim (student_id = null) kaydedilirdi.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase yapılandırması eksik: NEXT_PUBLIC_SUPABASE_URL ve ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlanmalı.',
    );
  }

  return createBrowserClient(url, anonKey);
}
