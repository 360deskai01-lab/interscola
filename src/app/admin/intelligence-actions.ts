'use server';

import { revalidatePath } from 'next/cache';
import { requireApprovedAdmin } from '@/app/admin/actions';
import {
  fetchSourceDocumentText,
  hashSourceHtml,
} from '@/lib/intelligence/source-hash';
import type {
  IntelligenceAlertResolution,
  IntelligenceAlertRow,
  IntelligenceAlertStatus,
  IntelligenceDashboardSummary,
  SourceCheckRunSummary,
} from '@/lib/intelligence/types';
import { formatSupabaseError } from '@/lib/universities/supabase-error';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

const ADMIN_DASHBOARD_PATH = '/admin/dashboard';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPublicClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

type DbAlertRow = {
  id: string;
  university_id: string;
  status: string;
  source_url: string;
  previous_content_hash: string | null;
  new_content_hash: string;
  detected_at: string;
  resolved_at: string | null;
  target_universities: { name: string } | { name: string }[] | null;
};

type DbUniversitySourceRow = {
  id: string;
  name: string;
  source_url: string | null;
  source_content_hash: string | null;
};

function universityNameFromJoin(
  joined: DbAlertRow['target_universities'],
): string {
  if (!joined) return 'Bilinmeyen üniversite';
  if (Array.isArray(joined)) {
    return joined[0]?.name?.trim() || 'Bilinmeyen üniversite';
  }
  return joined.name?.trim() || 'Bilinmeyen üniversite';
}

function mapAlertRow(row: DbAlertRow): IntelligenceAlertRow {
  return {
    id: row.id,
    universityId: row.university_id,
    universityName: universityNameFromJoin(row.target_universities),
    status: parseAlertStatus(row.status),
    sourceUrl: row.source_url,
    previousContentHash: row.previous_content_hash,
    newContentHash: row.new_content_hash,
    detectedAt: row.detected_at,
    resolvedAt: row.resolved_at,
  };
}

function parseAlertStatus(raw: string): IntelligenceAlertStatus {
  if (raw === 'reviewed' || raw === 'dismissed') return raw;
  return 'pending';
}

export async function getIntelligenceAlertsAction(): Promise<{
  success: boolean;
  error?: string;
  data?: IntelligenceDashboardSummary;
}> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return {
        success: false,
        error: 'Bu veri için master admin yetkisi gerekiyor.',
      };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: alertData, error: alertError } = await client
      .from('intelligence_alerts')
      .select(
        `
        id,
        university_id,
        status,
        source_url,
        previous_content_hash,
        new_content_hash,
        detected_at,
        resolved_at,
        target_universities ( name )
      `,
      )
      .in('status', ['pending', 'reviewed'])
      .order('detected_at', { ascending: false })
      .limit(100);

    if (alertError) {
      if (alertError.code === '42P01' || alertError.code === '42703') {
        return {
          success: false,
          error:
            'intelligence_alerts tablosu veya ilişki henüz yok. Migration uygulayın.',
        };
      }
      console.error(
        '[intel] Uyarı listesi okunamadı:',
        formatSupabaseError(alertError),
      );
      return { success: false, error: 'İstihbarat uyarıları okunamadı.' };
    }

    const alerts = ((alertData ?? []) as DbAlertRow[]).map(mapAlertRow);

    const pendingCount = alerts.filter((a) => a.status === 'pending').length;
    const reviewedCount = alerts.filter((a) => a.status === 'reviewed').length;

    const { count: monitoredSourceCount, error: monitoredError } = await client
      .from('target_universities')
      .select('id', { count: 'exact', head: true })
      .not('source_url', 'is', null);

    if (monitoredError?.code === '42703') {
      return {
        success: false,
        error: 'source_url kolonu henüz tanımlı değil. Migration uygulayın.',
      };
    }

    const { count: lastCheckedCount, error: checkedError } = await client
      .from('target_universities')
      .select('id', { count: 'exact', head: true })
      .not('source_url', 'is', null)
      .not('last_checked_at', 'is', null);

    if (checkedError?.code === '42703') {
      return {
        success: false,
        error: 'last_checked_at kolonu henüz tanımlı değil. Migration uygulayın.',
      };
    }

    return {
      success: true,
      data: {
        pendingCount,
        reviewedCount,
        monitoredSourceCount: monitoredSourceCount ?? 0,
        lastCheckedCount: lastCheckedCount ?? 0,
        alerts,
      },
    };
  } catch (error) {
    console.error(
      '[intel] getIntelligenceAlertsAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'İstihbarat verisi yüklenemedi.' };
  }
}

export async function dismissOrResolveAlertAction(
  alertId: string,
  action: IntelligenceAlertResolution,
): Promise<{ success: boolean; message?: string }> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return {
        success: false,
        message: 'Bu işlem için master admin yetkisi gerekiyor.',
      };
    }

    if (!UUID_PATTERN.test(alertId)) {
      return { success: false, message: 'Geçersiz uyarı kimliği.' };
    }

    if (action !== 'reviewed' && action !== 'dismissed') {
      return { success: false, message: 'Geçersiz işlem türü.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, message: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { error } = await client
      .from('intelligence_alerts')
      .update({
        status: action,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('status', 'pending');

    if (error) {
      console.error('[intel] Uyarı güncellenemedi:', formatSupabaseError(error));
      return { success: false, message: 'Uyarı durumu kaydedilemedi.' };
    }

    revalidatePath(ADMIN_DASHBOARD_PATH);
    return {
      success: true,
      message:
        action === 'reviewed'
          ? 'Uyarı incelendi olarak işaretlendi.'
          : 'Uyarı yoksayıldı.',
    };
  } catch (error) {
    console.error(
      '[intel] dismissOrResolveAlertAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, message: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function checkUniversitySourceChangesAction(
  universityId?: string,
): Promise<{
  success: boolean;
  message?: string;
  data?: SourceCheckRunSummary;
}> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return {
        success: false,
        message: 'Bu işlem için master admin yetkisi gerekiyor.',
      };
    }

    if (universityId !== undefined && !UUID_PATTERN.test(universityId)) {
      return { success: false, message: 'Geçersiz üniversite kimliği.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, message: 'Veritabanı bağlantısı kurulamadı.' };
    }

    let query = client
      .from('target_universities')
      .select('id, name, source_url, source_content_hash')
      .not('source_url', 'is', null);

    if (universityId) {
      query = query.eq('id', universityId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42703') {
        return {
          success: false,
          message: 'source_url kolonu henüz tanımlı değil. Migration uygulayın.',
        };
      }
      console.error('[intel] Kaynak listesi okunamadı:', formatSupabaseError(error));
      return { success: false, message: 'İzlenecek kaynaklar okunamadı.' };
    }

    const rows = (data ?? []) as DbUniversitySourceRow[];
    const candidates = rows.filter((row) => row.source_url?.trim());

    if (candidates.length === 0) {
      return {
        success: true,
        message: 'source_url tanımlı üniversite bulunamadı.',
        data: { checked: 0, alertsCreated: 0, skipped: 0, failures: [] },
      };
    }

    const nowIso = new Date().toISOString();
    let checked = 0;
    let alertsCreated = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const row of candidates) {
      const sourceUrl = row.source_url!.trim();
      const fetchResult = await fetchSourceDocumentText(sourceUrl);

      if (!fetchResult.ok) {
        failures.push(`${row.name}: ${fetchResult.error}`);
        skipped += 1;
        continue;
      }

      const newHash = hashSourceHtml(fetchResult.text);
      const previousHash = row.source_content_hash?.trim() || null;
      checked += 1;

      const hashChanged =
        previousHash !== null && previousHash.length > 0 && previousHash !== newHash;

      if (hashChanged) {
        const { error: insertError } = await client
          .from('intelligence_alerts')
          .insert({
            university_id: row.id,
            status: 'pending',
            source_url: sourceUrl,
            previous_content_hash: previousHash,
            new_content_hash: newHash,
            detected_at: nowIso,
          });

        if (insertError) {
          failures.push(
            `${row.name}: uyarı kaydı oluşturulamadı (${insertError.message})`,
          );
        } else {
          alertsCreated += 1;
        }
      }

      const { error: updateError } = await client
        .from('target_universities')
        .update({
          source_content_hash: newHash,
          last_checked_at: nowIso,
        })
        .eq('id', row.id);

      if (updateError) {
        failures.push(
          `${row.name}: hash güncellenemedi (${updateError.message})`,
        );
      }
    }

    revalidatePath(ADMIN_DASHBOARD_PATH);

    const summary: SourceCheckRunSummary = {
      checked,
      alertsCreated,
      skipped,
      failures,
    };

    const baseMessage = `${checked} kaynak tarandı, ${alertsCreated} yeni uyarı oluşturuldu.`;
    if (failures.length > 0) {
      return {
        success: true,
        message: `${baseMessage} ${failures.length} kayıt atlandı veya kısmen başarısız.`,
        data: summary,
      };
    }

    return { success: true, message: baseMessage, data: summary };
  } catch (error) {
    console.error(
      '[intel] checkUniversitySourceChangesAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, message: 'Kaynak taraması tamamlanamadı.' };
  }
}
