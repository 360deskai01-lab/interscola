import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Deneme kayıtlarının tutulduğu şema. Paneldeki kullanıcı/kurum tabloları ise
 * `public` şemasındadır — bu yüzden iki ayrı istemci gerekiyor.
 */
const ATTEMPTS_SCHEMA = 'interscola';

/**
 * Kullanıcı, kurum ve şube tablolarının şeması.
 * TEK KAYNAK: diğer dosyalar bu sabiti buradan import eder.
 */
export const PROFILES_SCHEMA = 'public';

/** Sınav denemelerinin saklandığı tablo. */
export const ATTEMPTS_TABLE = 'assessment_attempts';

/** Şema bazlı istemci önbelleği: `interscola` ve `public` ayrı ayrı tutulur. */
const cache = new Map<string, SupabaseClient>();

/**
 * Sunucu tarafı Supabase istemcisi (service role).
 *
 * GÜVENLİK: Bu istemci yalnızca Route Handler / Server Component içinde
 * kullanılmalıdır. Service role anahtarı RLS'i baypas eder; `'use client'`
 * dosyalarından import edilirse anahtar tarayıcı paketine sızar.
 *
 * Yapılandırma eksikse `null` döner; çağıran taraf kalıcılığı sessizce atlar.
 * Böylece Supabase kurulmadan da sınav/değerlendirme akışı çalışmaya devam eder.
 *
 * @param schema Hangi Postgres şemasına bağlanılacağı. Varsayılan `interscola`.
 */
export function getSupabaseAdmin(
  schema: string = ATTEMPTS_SCHEMA,
): SupabaseClient | null {
  const cached = cache.get(schema);
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.warn(
      '[supabase] SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY tanımlı değil; ' +
        'service role istemcisi kullanılamıyor.',
    );
    return null;
  }

  // Şema literal tip olarak verilir; aksi halde dönüş tipi 'public' varsayılır
  // ve farklı şemalara erişen sorgular derlenmez.
  const client = createClient(url, serviceRoleKey, {
    db: { schema: schema as 'public' },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  cache.set(schema, client);
  return client;
}
