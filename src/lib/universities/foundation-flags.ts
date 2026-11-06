import type { SupabaseClient } from '@supabase/supabase-js';
import type { University } from '@/lib/universities/types';

/**
 * `target_universities.has_foundation_pathway` ayrı, hata-toleranslı bir sorguyla okunur.
 *
 * NEDEN ANA SELECT'E EKLENMEDİ: `TARGET_UNIVERSITY_SELECT` ana sayfa vitrini, bütçe
 * simülatörü ve komuta merkezi dahil çok sayıda yolda kullanılıyor; bazılarının 42703
 * fallback'i yok. Sütun migration'dan önce okunursa tüm üniversite yüzeyleri
 * düşerdi. Bu yardımcı sütun yoksa sessizce "foundation yok" döner.
 */
export async function loadFoundationPathwayIds(
  client: SupabaseClient,
  universityIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(universityIds.filter(Boolean))];
  if (ids.length === 0) return new Set();

  const { data, error } = await client
    .from('target_universities')
    .select('id')
    .in('id', ids)
    .eq('has_foundation_pathway', true);

  if (error) {
    if (error.code !== '42703') {
      console.error(
        '[universities] Foundation bayrağı okunamadı:',
        error.message,
      );
    }
    return new Set();
  }

  return new Set(
    (data ?? [])
      .map((row) => (row as { id?: string }).id)
      .filter((id): id is string => typeof id === 'string'),
  );
}

export async function attachFoundationFlags(
  client: SupabaseClient,
  universities: University[],
): Promise<University[]> {
  if (universities.length === 0) return universities;
  const flagged = await loadFoundationPathwayIds(
    client,
    universities.map((u) => u.id),
  );
  if (flagged.size === 0) return universities;
  return universities.map((u) =>
    flagged.has(u.id) ? { ...u, has_foundation_pathway: true } : u,
  );
}
