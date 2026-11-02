'use server';

import { revalidatePath } from 'next/cache';
import { requireApprovedAdmin } from '@/app/admin/actions';
import type {
  AdminUniversitiesSummary,
  AdminUniversityRow,
  BulkUniversityImportRow,
  UniversityImportRecord,
  UniversityPublicationStatus,
  UniversityUpsertInput,
} from '@/lib/universities/admin-types';
import { slugifyUniversityName, ensureUniqueSlug } from '@/lib/universities/slug';
import { formatSupabaseError } from '@/lib/universities/supabase-error';
import { TARGET_UNIVERSITY_SELECT } from '@/lib/universities/repository';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
const HOME_PATH = '/';
const UNIVERSITIES_PATH = '/universities';

const ADMIN_UNIVERSITY_SELECT = `${TARGET_UNIVERSITY_SELECT}, is_featured, status, source_url`;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type {
  BulkUniversityImportRow,
  UniversityImportRecord,
  UniversityUpsertInput,
} from '@/lib/universities/admin-types';

const VALID_STATUSES: readonly UniversityPublicationStatus[] = [
  'published',
  'draft',
  'archived',
];

async function getPublicClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

type DbUniversityAdminRow = {
  id: string;
  slug: string | null;
  name: string;
  country: string;
  city: string | null;
  min_sat_score: number | null;
  min_ielts_band: number | string | null;
  min_alevel: string | null;
  website_url: string | null;
  tuition_fee_range: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  source_url?: string | null;
  is_featured?: boolean | null;
  status?: string | null;
};

function parseStatus(raw: string | null | undefined): UniversityPublicationStatus {
  if (raw === 'draft' || raw === 'archived' || raw === 'published') {
    return raw;
  }
  return 'published';
}

function revalidateUniversitySurfaces(slug?: string | null): void {
  revalidatePath(HOME_PATH);
  revalidatePath(UNIVERSITIES_PATH);
  revalidatePath(ADMIN_DASHBOARD_PATH);
  const trimmed = slug?.trim();
  if (trimmed) {
    revalidatePath(`${UNIVERSITIES_PATH}/${trimmed}`);
  }
}

function mapAdminUniversityRow(row: DbUniversityAdminRow): AdminUniversityRow {
  const bandRaw = row.min_ielts_band;
  const minIeltsBand =
    bandRaw === null || bandRaw === undefined
      ? null
      : typeof bandRaw === 'number'
        ? bandRaw
        : Number.parseFloat(String(bandRaw));

  return {
    id: row.id,
    slug: row.slug?.trim() ?? '',
    name: row.name,
    country: row.country,
    city: row.city ?? null,
    minSatScore: row.min_sat_score ?? null,
    minIeltsBand: Number.isFinite(minIeltsBand) ? minIeltsBand : null,
    minAlevel: row.min_alevel?.trim() || null,
    websiteUrl: row.website_url ?? null,
    tuitionFeeRange: row.tuition_fee_range ?? null,
    isFeatured: row.is_featured === true,
    status: parseStatus(row.status),
    logoUrl: row.logo_url?.trim() || null,
    coverImageUrl: row.cover_image_url?.trim() || null,
    sourceUrl: row.source_url?.trim() || null,
  };
}

function normalizeOptionalMediaUrl(
  raw: string,
  label: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        ok: false,
        message: `${label} yalnızca http veya https ile başlamalıdır.`,
      };
    }
    return { ok: true, value: trimmed };
  } catch {
    return { ok: false, message: `${label} geçerli bir URL olmalıdır.` };
  }
}

export async function updateUniversityMediaAction(
  id: string,
  logoUrl: string,
  coverImageUrl: string,
  sourceUrl?: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return {
        success: false,
        message: 'Bu işlem için master admin yetkisi gerekiyor.',
      };
    }

    if (!UUID_PATTERN.test(id)) {
      return { success: false, message: 'Geçersiz üniversite kimliği.' };
    }

    const logo = normalizeOptionalMediaUrl(logoUrl, 'Logo URL');
    if (!logo.ok) {
      return { success: false, message: logo.message };
    }

    const cover = normalizeOptionalMediaUrl(coverImageUrl, 'Kapak görseli URL');
    if (!cover.ok) {
      return { success: false, message: cover.message };
    }

    const source = normalizeOptionalMediaUrl(
      sourceUrl ?? '',
      'Resmi kabul sayfası URL',
    );
    if (!source.ok) {
      return { success: false, message: source.message };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, message: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { error } = await client
      .from('target_universities')
      .update({
        logo_url: logo.value,
        cover_image_url: cover.value,
        source_url: source.value,
      })
      .eq('id', id);

    if (error) {
      console.error('[admin-univ] Medya güncellenemedi:', formatSupabaseError(error));
      if (error.code === '42703') {
        return {
          success: false,
          message:
            'logo_url, cover_image_url veya source_url kolonları bulunamadı. Migration uygulayın.',
        };
      }
      return { success: false, message: 'Kayıt güncellenemedi.' };
    }

    revalidateUniversitySurfaces();

    return {
      success: true,
      message: 'Üniversite görselleri ve kaynak URL güncellendi.',
    };
  } catch (error) {
    console.error(
      '[admin-univ] updateUniversityMediaAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, message: 'Beklenmeyen bir hata oluştu.' };
  }
}

async function fetchManagedUniversitiesSummary(): Promise<
  | { success: true; data: AdminUniversitiesSummary }
  | { success: false; error: string }
> {
  const client = await getPublicClient();
  if (!client) {
    return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
  }

  let rows: DbUniversityAdminRow[] = [];
  const { data, error } = await client
    .from('target_universities')
    .select(ADMIN_UNIVERSITY_SELECT)
    .order('name', { ascending: true });

  if (error) {
    if (error.code === '42703') {
      const fallback = await client
        .from('target_universities')
        .select(TARGET_UNIVERSITY_SELECT)
        .order('name', { ascending: true });
      if (fallback.error) {
        console.error('[admin-univ] Liste okunamadı:', fallback.error.message);
        return { success: false, error: 'Üniversite listesi okunamadı.' };
      }
      rows = ((fallback.data ?? []) as DbUniversityAdminRow[]).map((row) => ({
        ...row,
        is_featured: false,
        status: 'published',
      }));
    } else {
      console.error('[admin-univ] Liste okunamadı:', formatSupabaseError(error));
      return { success: false, error: 'Üniversite listesi okunamadı.' };
    }
  } else {
    rows = (data ?? []) as DbUniversityAdminRow[];
  }

  const universities = rows.map(mapAdminUniversityRow);
  const featuredCount = universities.filter((u) => u.isFeatured).length;

  return {
    success: true,
    data: {
      total: universities.length,
      featuredCount,
      universities,
    },
  };
}

export async function listManagedUniversitiesAction(): Promise<{
  success: boolean;
  error?: string;
  universities?: AdminUniversityRow[];
}> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu veri için master admin yetkisi gerekiyor.' };
    }

    const result = await fetchManagedUniversitiesSummary();
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, universities: result.data.universities };
  } catch (error) {
    console.error(
      '[admin-univ] listManagedUniversitiesAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Üniversite verisi yüklenemedi.' };
  }
}

export async function getAdminUniversitiesAction(): Promise<{
  success: boolean;
  error?: string;
  data?: AdminUniversitiesSummary;
}> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu veri için master admin yetkisi gerekiyor.' };
    }

    const result = await fetchManagedUniversitiesSummary();
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error(
      '[admin-univ] getAdminUniversitiesAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Üniversite verisi yüklenemedi.' };
  }
}

export async function updateUniversityStatusAction(
  id: string,
  status: UniversityPublicationStatus,
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    if (!UUID_PATTERN.test(id)) {
      return { success: false, error: 'Geçersiz üniversite kimliği.' };
    }

    if (!VALID_STATUSES.includes(status)) {
      return { success: false, error: 'Geçersiz yayın durumu.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: existing, error: readError } = await client
      .from('target_universities')
      .select('slug')
      .eq('id', id)
      .maybeSingle();

    if (readError || !existing) {
      return { success: false, error: 'Üniversite bulunamadı.' };
    }

    const { error } = await client
      .from('target_universities')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('[admin-univ] Durum güncellenemedi:', formatSupabaseError(error));
      if (error.code === '42703') {
        return {
          success: false,
          error: 'status kolonu henüz tanımlı değil. Migration uygulayın.',
        };
      }
      return { success: false, error: 'Yayın durumu kaydedilemedi.' };
    }

    revalidateUniversitySurfaces(
      (existing as { slug?: string | null }).slug ?? undefined,
    );
    return { success: true };
  } catch (error) {
    console.error(
      '[admin-univ] updateUniversityStatusAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function toggleUniversityFeaturedAction(
  id: string,
  isFeatured: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    if (!UUID_PATTERN.test(id)) {
      return { success: false, error: 'Geçersiz üniversite kimliği.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { error } = await client
      .from('target_universities')
      .update({ is_featured: isFeatured })
      .eq('id', id);

    if (error) {
      console.error('[admin-univ] Vitrin güncellenemedi:', error.message);
      if (error.code === '42703') {
        return {
          success: false,
          error: 'is_featured kolonu henüz tanımlı değil. Migration uygulayın.',
        };
      }
      return { success: false, error: 'Vitrin durumu kaydedilemedi.' };
    }

    revalidatePath(HOME_PATH);
    revalidatePath(ADMIN_DASHBOARD_PATH);
    return { success: true };
  } catch (error) {
    console.error(
      '[admin-univ] toggleUniversityFeaturedAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

function validateImportRow(
  row: BulkUniversityImportRow,
  index: number,
): { ok: true; row: BulkUniversityImportRow } | { ok: false; error: string } {
  const name = row.name?.trim() ?? '';
  const country = row.country?.trim() ?? '';
  const city = row.city?.trim() ?? '';

  if (name.length < 2) {
    return { ok: false, error: `Satır ${index + 1}: üniversite adı zorunlu.` };
  }
  if (country.length < 2) {
    return { ok: false, error: `Satır ${index + 1}: ülke zorunlu.` };
  }
  if (city.length < 1) {
    return { ok: false, error: `Satır ${index + 1}: şehir zorunlu.` };
  }

  if (row.minSat !== undefined) {
    if (!Number.isFinite(row.minSat) || row.minSat < 400 || row.minSat > 1600) {
      return { ok: false, error: `Satır ${index + 1}: Min SAT 400–1600 aralığında olmalı.` };
    }
  }

  if (row.minIelts !== undefined) {
    if (!Number.isFinite(row.minIelts) || row.minIelts < 0 || row.minIelts > 9) {
      return { ok: false, error: `Satır ${index + 1}: Min IELTS 0–9 aralığında olmalı.` };
    }
  }

  const slug = row.slug?.trim() || undefined;
  if (slug && slug.length < 2) {
    return { ok: false, error: `Satır ${index + 1}: slug en az 2 karakter olmalı.` };
  }

  const status = row.status;
  if (status && !VALID_STATUSES.includes(status)) {
    return { ok: false, error: `Satır ${index + 1}: geçersiz status değeri.` };
  }

  return {
    ok: true,
    row: {
      name,
      country,
      city,
      slug,
      minSat: row.minSat,
      minIelts: row.minIelts,
      minAlevel: row.minAlevel?.trim() || undefined,
      websiteUrl: row.websiteUrl?.trim() || undefined,
      tuitionFeeRange: row.tuitionFeeRange?.trim() || undefined,
      status,
    },
  };
}

function resolveImportSlug(
  row: BulkUniversityImportRow,
  usedSlugs: Set<string>,
): string | { error: string } {
  if (row.slug?.trim()) {
    const normalized = slugifyUniversityName(row.slug);
    if (usedSlugs.has(normalized)) {
      return { error: `"${normalized}" slug'ı aynı yüklemede mükerrer.` };
    }
    usedSlugs.add(normalized);
    return normalized;
  }
  const base = slugifyUniversityName(row.name);
  return ensureUniqueSlug(base, usedSlugs);
}

export async function bulkImportUniversitiesAction(
  records: UniversityImportRecord[],
): Promise<{
  success: boolean;
  error?: string;
  imported?: number;
  skipped?: number;
}> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    if (!Array.isArray(records) || records.length === 0) {
      return { success: false, error: 'İçe aktarılacak satır yok.' };
    }

    if (records.length > 500) {
      return { success: false, error: 'Tek seferde en fazla 500 satır yüklenebilir.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const validated: BulkUniversityImportRow[] = [];
    for (let i = 0; i < records.length; i += 1) {
      const result = validateImportRow(records[i]!, i);
      if (!result.ok) {
        return { success: false, error: result.error };
      }
      validated.push(result.row);
    }

    const { data: existingSlugs, error: slugError } = await client
      .from('target_universities')
      .select('slug');

    if (slugError) {
      console.error('[admin-univ] Slug listesi okunamadı:', slugError.message);
      return { success: false, error: 'Mükerrer kontrolü yapılamadı.' };
    }

    const usedSlugs = new Set<string>(
      ((existingSlugs ?? []) as { slug: string | null }[])
        .map((item) => item.slug?.trim())
        .filter((slug): slug is string => Boolean(slug)),
    );

    const payload: {
      slug: string;
      name: string;
      country: string;
      city: string;
      min_sat_score: number | null;
      min_ielts_band: number | null;
      min_alevel: string | null;
      website_url: string | null;
      tuition_fee_range: string | null;
      status: UniversityPublicationStatus;
      is_featured: boolean;
    }[] = [];

    for (const row of validated) {
      const slugResult = resolveImportSlug(row, usedSlugs);
      if (typeof slugResult !== 'string') {
        return { success: false, error: slugResult.error };
      }

      payload.push({
        slug: slugResult,
        name: row.name,
        country: row.country,
        city: row.city,
        min_sat_score: row.minSat ?? null,
        min_ielts_band: row.minIelts ?? null,
        min_alevel: row.minAlevel ?? null,
        website_url: row.websiteUrl ?? null,
        tuition_fee_range: row.tuitionFeeRange ?? null,
        status: row.status ?? 'published',
        is_featured: false,
      });
    }

    const { error: upsertError } = await client
      .from('target_universities')
      .upsert(payload, { onConflict: 'slug' });

    if (upsertError) {
      console.error('[admin-univ] Toplu içe aktarma:', formatSupabaseError(upsertError));
      if (upsertError.code === '42703') {
        return {
          success: false,
          error:
            'Tablo şeması güncel değil (status/is_featured). Migration uygulayın.',
        };
      }
      return { success: false, error: 'CSV satırları kaydedilemedi.' };
    }

    revalidateUniversitySurfaces();

    return {
      success: true,
      imported: payload.length,
      skipped: 0,
    };
  } catch (error) {
    console.error(
      '[admin-univ] bulkImportUniversitiesAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

function validateUpsertInput(
  input: UniversityUpsertInput,
): { ok: true; data: UniversityUpsertInput } | { ok: false; error: string } {
  const name = input.name?.trim() ?? '';
  const country = input.country?.trim() ?? '';
  const city = input.city?.trim() ?? '';

  if (name.length < 2) {
    return { ok: false, error: 'Üniversite adı zorunlu (en az 2 karakter).' };
  }
  if (country.length < 2) {
    return { ok: false, error: 'Ülke zorunlu.' };
  }
  if (city.length < 1) {
    return { ok: false, error: 'Şehir zorunlu.' };
  }

  if (input.minSatScore != null) {
    if (
      !Number.isFinite(input.minSatScore) ||
      input.minSatScore < 400 ||
      input.minSatScore > 1600
    ) {
      return { ok: false, error: 'Min SAT 400–1600 aralığında olmalı.' };
    }
  }

  if (input.minIeltsBand != null) {
    if (
      !Number.isFinite(input.minIeltsBand) ||
      input.minIeltsBand < 0 ||
      input.minIeltsBand > 9
    ) {
      return { ok: false, error: 'Min IELTS 0–9 aralığında olmalı.' };
    }
  }

  const status = input.status;
  if (status && !VALID_STATUSES.includes(status)) {
    return { ok: false, error: 'Geçersiz yayın durumu.' };
  }

  if (input.id && !UUID_PATTERN.test(input.id)) {
    return { ok: false, error: 'Geçersiz üniversite kimliği.' };
  }

  return {
    ok: true,
    data: {
      ...input,
      name,
      country,
      city,
      slug: input.slug?.trim() || undefined,
      minAlevel: input.minAlevel?.trim() || null,
      websiteUrl: input.websiteUrl?.trim() || null,
      tuitionFeeRange: input.tuitionFeeRange?.trim() || null,
      status: status ?? 'draft',
    },
  };
}

export async function upsertSingleUniversityAction(
  input: UniversityUpsertInput,
): Promise<{ success: boolean; error?: string; id?: string; slug?: string }> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    const validated = validateUpsertInput(input);
    if (!validated.ok) {
      return { success: false, error: validated.error };
    }
    const data = validated.data;

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    let slug = data.slug ? slugifyUniversityName(data.slug) : '';

    if (data.id) {
      if (!slug) {
        const { data: row, error: readError } = await client
          .from('target_universities')
          .select('slug')
          .eq('id', data.id)
          .maybeSingle();
        if (readError || !row?.slug) {
          return { success: false, error: 'Üniversite bulunamadı.' };
        }
        slug = String(row.slug).trim();
      }

      const { error } = await client
        .from('target_universities')
        .update({
          slug,
          name: data.name,
          country: data.country,
          city: data.city,
          min_sat_score: data.minSatScore ?? null,
          min_ielts_band: data.minIeltsBand ?? null,
          min_alevel: data.minAlevel,
          website_url: data.websiteUrl,
          tuition_fee_range: data.tuitionFeeRange,
          status: data.status ?? 'draft',
        })
        .eq('id', data.id);

      if (error) {
        console.error('[admin-univ] Tekil güncelleme:', formatSupabaseError(error));
        if (error.code === '23505') {
          return { success: false, error: 'Bu slug başka bir kayıtta kullanılıyor.' };
        }
        return { success: false, error: 'Kayıt güncellenemedi.' };
      }

      revalidateUniversitySurfaces(slug);
      return { success: true, id: data.id, slug };
    }

    if (!slug) {
      const { data: existingSlugs, error: slugError } = await client
        .from('target_universities')
        .select('slug');
      if (slugError) {
        return { success: false, error: 'Slug üretilemedi.' };
      }
      const usedSlugs = new Set<string>(
        ((existingSlugs ?? []) as { slug: string | null }[])
          .map((item) => item.slug?.trim())
          .filter((s): s is string => Boolean(s)),
      );
      slug = ensureUniqueSlug(slugifyUniversityName(data.name), usedSlugs);
    }

    const row = {
      slug,
      name: data.name,
      country: data.country,
      city: data.city,
      min_sat_score: data.minSatScore ?? null,
      min_ielts_band: data.minIeltsBand ?? null,
      min_alevel: data.minAlevel,
      website_url: data.websiteUrl,
      tuition_fee_range: data.tuitionFeeRange,
      status: data.status ?? 'draft',
      is_featured: false,
    };

    const { data: inserted, error: upsertError } = await client
      .from('target_universities')
      .upsert(row, { onConflict: 'slug' })
      .select('id, slug')
      .single();

    if (upsertError) {
      console.error('[admin-univ] Tekil upsert:', formatSupabaseError(upsertError));
      return { success: false, error: 'Kayıt kaydedilemedi.' };
    }

    revalidateUniversitySurfaces(inserted.slug);
    return {
      success: true,
      id: inserted.id as string,
      slug: inserted.slug as string,
    };
  } catch (error) {
    console.error(
      '[admin-univ] upsertSingleUniversityAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function toggleUniversityFeaturedFormAction(
  id: string,
  isFeatured: boolean,
): Promise<{ success: boolean; error?: string }> {
  return toggleUniversityFeaturedAction(id, isFeatured);
}

export async function bulkImportUniversitiesFormAction(
  records: UniversityImportRecord[],
): Promise<{
  success: boolean;
  error?: string;
  imported?: number;
}> {
  const result = await bulkImportUniversitiesAction(records);
  return {
    success: result.success,
    error: result.error,
    imported: result.imported,
  };
}

export async function updateUniversityStatusFormAction(
  id: string,
  status: UniversityPublicationStatus,
): Promise<{ success: boolean; error?: string }> {
  return updateUniversityStatusAction(id, status);
}

export async function upsertSingleUniversityFormAction(
  input: UniversityUpsertInput,
): Promise<{ success: boolean; error?: string; id?: string; slug?: string }> {
  return upsertSingleUniversityAction(input);
}
