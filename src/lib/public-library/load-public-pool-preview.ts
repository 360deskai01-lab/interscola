import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';

export interface PublicPoolPreviewItem {
  id: string;
  title: string;
  createdAt: string;
}

/** Anasayfa vitrin — oturum gerektirmez (yalnızca doğrulanmış açık havuz). */
export async function loadRecentPublicPoolPreview(
  limit = 4,
): Promise<PublicPoolPreviewItem[]> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!admin) return [];

  const { data, error } = await admin
    .from('libraries')
    .select('id, title, created_at')
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as { id: string; title: string; created_at: string }[]).map(
    (row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
    }),
  );
}
