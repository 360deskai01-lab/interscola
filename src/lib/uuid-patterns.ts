/** RFC 4122 uyumlu atama / oturum kimlikleri (sürüm + variant nibble zorunlu). */
export const STRICT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * `public.libraries.id` — Postgres uuid + e2e tohum (`e2e00000-0000-0000-0000-…`) dahil.
 * Sürüm nibble kontrolü yapılmaz; aksi halde test seed'leri reddedilir.
 */
export const LIBRARY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isLibraryId(value: string): boolean {
  return LIBRARY_ID_PATTERN.test(value.trim());
}
