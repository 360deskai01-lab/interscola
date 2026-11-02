import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const cache = new Map<string, SupabaseClient>();

/**
 * Oturum çerezi okumayan anonim istemci — `"use cache"` ve SSG/ISR için güvenli.
 * `target_universities` gibi herkese açık okumalar RLS ile anon erişime açıksa yeterlidir.
 */
export function getSupabasePublicAnon(
  schema = 'public',
): SupabaseClient | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  const cached = cache.get(schema);
  if (cached) return cached;

  const client = createClient(url, anonKey, {
    db: { schema: schema as 'public' },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  cache.set(schema, client);
  return client;
}
