import type {
  BulkUniversityImportRow,
  UniversityPublicationStatus,
} from '@/lib/universities/admin-types';

function readString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(
  record: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined || value === '') continue;
    const num =
      typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (Number.isFinite(num)) return num;
  }
  return undefined;
}

function readStatus(
  record: Record<string, unknown>,
): UniversityPublicationStatus | undefined {
  const raw = readString(record, ['status', 'durum']);
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower === 'draft' || lower === 'taslak') return 'draft';
  if (lower === 'archived' || lower === 'arsiv' || lower === 'arşiv') {
    return 'archived';
  }
  if (lower === 'published' || lower === 'yayinda' || lower === 'yayında') {
    return 'published';
  }
  return undefined;
}

/** JSON dizi veya tek nesne → normalize edilmiş içe aktarma satırları. */
export function parseJsonUniversityImports(
  text: string,
): { ok: true; rows: BulkUniversityImportRow[] } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'JSON metni boş.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, error: 'Geçersiz JSON.' };
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (list.length === 0) {
    return { ok: false, error: 'JSON dizisi boş.' };
  }

  const rows: BulkUniversityImportRow[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {
        ok: false,
        error: `Kayıt ${i + 1}: nesne bekleniyordu.`,
      };
    }
    const record = item as Record<string, unknown>;
    const name = readString(record, ['name', 'university', 'üniversite']);
    const country = readString(record, ['country', 'ülke', 'ulke']);
    const city = readString(record, ['city', 'şehir', 'sehir']);

    if (!name || !country || !city) {
      return {
        ok: false,
        error: `Kayıt ${i + 1}: name, country ve city zorunlu.`,
      };
    }

    rows.push({
      name,
      country,
      city,
      slug: readString(record, ['slug']),
      minSat: readNumber(record, [
        'minSat',
        'min_sat',
        'min_sat_score',
        'minsat',
      ]),
      minIelts: readNumber(record, [
        'minIelts',
        'min_ielts',
        'min_ielts_band',
        'minielts',
      ]),
      minAlevel: readString(record, [
        'minAlevel',
        'min_alevel',
        'minalevel',
        'a_level',
      ]),
      websiteUrl: readString(record, [
        'websiteUrl',
        'website_url',
        'website',
        'url',
      ]),
      tuitionFeeRange: readString(record, [
        'tuitionFeeRange',
        'tuition_fee_range',
        'tuition',
      ]),
      status: readStatus(record),
    });
  }

  return { ok: true, rows };
}
