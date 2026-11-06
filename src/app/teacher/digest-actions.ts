'use server';

import { revalidatePath } from 'next/cache';
import { GoogleGenAI } from '@google/genai';
import { getCurrentProfile } from '@/lib/auth';
import {
  ATTEMPTS_TABLE,
  getSupabaseAdmin,
  PROFILES_SCHEMA,
} from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface WeeklyDigestRow {
  id: string;
  body: string;
  status: 'draft' | 'published';
  weekStart: string;
  createdAt: string;
}

export type DigestActionResult<T = undefined> = {
  success: boolean;
  error?: string;
  data?: T;
};

async function getProfilesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

async function requireApprovedTeacher() {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.status !== 'approved') return null;
  if (current.profile.role !== 'teacher' && current.profile.role !== 'admin') {
    return null;
  }
  return current;
}

function mondayWeekStartIsoDate(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

async function verifyTeacherStudentLink(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('student_teachers')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('[digest] Öğrenci bağlantısı doğrulanamadı:', error.message);
    return false;
  }

  return Boolean(data);
}

function buildDeterministicDigest(input: {
  attemptCount: number;
  lastPct: number | null;
  firstPct: number | null;
  completedCount: number;
  overdueCount: number;
  studentName: string;
}): string {
  const pctDelta =
    input.firstPct !== null &&
    input.lastPct !== null &&
    Number.isFinite(input.firstPct) &&
    Number.isFinite(input.lastPct)
      ? Math.round(input.lastPct - input.firstPct)
      : null;

  const line1 =
    input.attemptCount > 0
      ? pctDelta !== null && pctDelta !== 0
        ? `1. Son 7 günde ${input.attemptCount} deneme kaydı var; net yüzde değişimi yaklaşık ${pctDelta > 0 ? '+' : ''}${pctDelta} puan.`
        : `1. Son 7 günde ${input.attemptCount} deneme tamamlandı; tutarlı performans izlenimi.`
      : `1. Son 7 günde henüz yeni deneme kaydı yok; ölçüm için kısa bir tekrar seti önerilir.`;

  const line2 =
    input.completedCount > 0
      ? `2. Bu dönemde ${input.completedCount} ödev/materyal tamamlandı.`
      : input.overdueCount > 0
        ? `2. Geciken ${input.overdueCount} öğe var; teslim tarihlerini birlikte netleştirin.`
        : `2. Ödev akışında belirgin gecikme yok; bir sonraki adım için net hedef koyun.`;

  const line3 =
    input.overdueCount > 0
      ? `3. Öncelik: geciken teslimler ve haftalık kelime / okuma disiplini (ör. ${input.studentName} ile mini plan).`
      : `3. Öncelik: bir sonraki hafta zayıf görünen müfredat alanında hedefli tekrar (okuma veya yazma).`;

  return [line1, line2, line3].join('\n');
}

async function generateDigestBodyWithGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `${prompt}\n\nYanıtında yalnızca 3 madde olsun; her satır "1. " ile başlasın. Türkçe, kısa ve pedagojik olsun.`,
    });
    const text = response.text?.trim();
    if (!text) return null;
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (lines.length < 3) return null;
    return lines.join('\n');
  } catch (error) {
    console.error(
      '[digest] Gemini hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Son 7 günü derleyerek haftalık taslak üretir ve `teacher_weekly_digests` tablosuna yazar.
 */
export async function generateStudentWeeklyDigestAction(
  studentId: string,
): Promise<DigestActionResult<WeeklyDigestRow>> {
  try {
    const current = await requireApprovedTeacher();
    if (!current) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğretmen hesabı gerekiyor.',
      };
    }

    if (!UUID_PATTERN.test(studentId)) {
      return { success: false, error: 'Geçersiz öğrenci kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const linked = await verifyTeacherStudentLink(
      client,
      current.user.id,
      studentId,
    );
    if (!linked) {
      return {
        success: false,
        error: 'Bu öğrenci sizin aktif listenizde değil.',
      };
    }

    const { data: studentProfile, error: spErr } = await client
      .from('profiles')
      .select('full_name, email')
      .eq('id', studentId)
      .maybeSingle();

    if (spErr) {
      console.error('[digest] Öğrenci profili okunamadı:', spErr.message);
    }

    const studentName =
      (studentProfile as { full_name?: string | null; email?: string } | null)
        ?.full_name?.trim() ||
      (studentProfile as { email?: string } | null)?.email?.trim() ||
      'Öğrenci';

    const now = new Date();
    const weekStartStr = mondayWeekStartIsoDate(now);
    const horizonMs = now.getTime();
    const rollingSinceMs = horizonMs - 7 * 24 * 60 * 60 * 1000;
    const sinceIso = new Date(rollingSinceMs).toISOString();

    let attemptCount = 0;
    let lastPct: number | null = null;
    let firstPct: number | null = null;

    const attemptsClient = getSupabaseAdmin('interscola');
    if (attemptsClient) {
      const { data: attemptRows, error: attErr } = await attemptsClient
        .from(ATTEMPTS_TABLE)
        .select('percentage, created_at')
        .eq('student_id', studentId)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true });

      if (attErr) {
        console.error('[digest] Denemeler okunamadı:', attErr.message);
      } else {
        const rows = (attemptRows ?? []) as {
          percentage: number | null;
          created_at: string;
        }[];
        attemptCount = rows.length;
        if (rows.length > 0) {
          firstPct =
            typeof rows[0].percentage === 'number'
              ? rows[0].percentage
              : null;
          const last = rows[rows.length - 1];
          lastPct =
            typeof last.percentage === 'number' ? last.percentage : null;
        }
      }
    }

    let completedCount = 0;
    let overdueCount = 0;

    let assignQuery = client
      .from('assignments')
      .select('id, status, created_at, due_date')
      .eq('student_id', studentId)
      .eq('teacher_id', current.user.id);

    let { data: assignRows, error: assignErr } = await assignQuery;

    if (assignErr?.code === '42703') {
      const fb = await client
        .from('assignments')
        .select('id, status, created_at')
        .eq('student_id', studentId)
        .eq('teacher_id', current.user.id);
      assignRows = fb.data as typeof assignRows;
      assignErr = fb.error;
    }

    if (assignErr) {
      console.error('[digest] Ödevler okunamadı:', assignErr.message);
    } else {
      for (const raw of assignRows ?? []) {
        const row = raw as {
          status: string;
          created_at: string;
          due_date?: string | null;
        };
        const created = new Date(row.created_at).getTime();
        if (
          created >= rollingSinceMs &&
          created <= horizonMs &&
          row.status === 'completed'
        ) {
          completedCount += 1;
        }
        if (row.status === 'completed') continue;
        const dueRaw = row.due_date;
        if (
          typeof dueRaw === 'string' &&
          dueRaw.trim() &&
          new Date(dueRaw).getTime() < horizonMs
        ) {
          overdueCount += 1;
        }
      }
    }

    const fallback = buildDeterministicDigest({
      attemptCount,
      lastPct,
      firstPct,
      completedCount,
      overdueCount,
      studentName,
    });

    const geminiPrompt = [
      `Öğrenci: ${studentName}`,
      `Son 7 gün: deneme sayısı ${attemptCount}, son yüzde ${lastPct ?? '—'}, ilk yüzde ${firstPct ?? '—'}.`,
      `Bu öğretmen atamalarında son 7 günde tamamlanan: ${completedCount}, halen gecikmiş teslimi olan: ${overdueCount}.`,
      'Pedagojik, destekleyici ve somut öneriler içeren 3 maddelik özet yaz.',
    ].join('\n');

    const aiBody = await generateDigestBodyWithGemini(geminiPrompt);
    const body = aiBody ?? fallback;

    const insertPayload: Record<string, unknown> = {
      teacher_id: current.user.id,
      student_id: studentId,
      body,
      status: 'draft',
      week_start: weekStartStr,
    };

    const { data: existing } = await client
      .from('teacher_weekly_digests')
      .select('id')
      .eq('teacher_id', current.user.id)
      .eq('student_id', studentId)
      .eq('week_start', weekStartStr)
      .eq('status', 'draft')
      .maybeSingle();

    let digestId: string | null = (existing as { id?: string } | null)?.id ?? null;

    if (digestId) {
      const { error: upErr } = await client
        .from('teacher_weekly_digests')
        .update({
          body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', digestId);

      if (upErr) {
        console.error('[digest] Taslak güncellenemedi:', upErr.message);
        return { success: false, error: 'Taslak kaydedilemedi.' };
      }
    } else {
      const { data: inserted, error: insErr } = await client
        .from('teacher_weekly_digests')
        .insert(insertPayload)
        .select('id, body, status, week_start, created_at')
        .maybeSingle();

      if (insErr) {
        if (insErr.code === '42P01' || insErr.message.includes('does not exist')) {
          return {
            success: false,
            error:
              'teacher_weekly_digests tablosu bulunamadı; migration uygulanmalı.',
          };
        }
        if (insErr.code === '23505') {
          const { data: again } = await client
            .from('teacher_weekly_digests')
            .select('id')
            .eq('teacher_id', current.user.id)
            .eq('student_id', studentId)
            .eq('week_start', weekStartStr)
            .eq('status', 'draft')
            .maybeSingle();
          digestId = (again as { id?: string } | null)?.id ?? null;
          if (digestId) {
            const { error: upErr2 } = await client
              .from('teacher_weekly_digests')
              .update({
                body,
                updated_at: new Date().toISOString(),
              })
              .eq('id', digestId);
            if (upErr2) {
              console.error('[digest] Taslak güncellenemedi:', upErr2.message);
              return { success: false, error: 'Taslak kaydedilemedi.' };
            }
          } else {
            console.error('[digest] Taslak kaydedilemedi:', insErr.message);
            return { success: false, error: 'Taslak kaydedilemedi.' };
          }
        } else {
          console.error('[digest] Taslak kaydedilemedi:', insErr.message);
          return { success: false, error: 'Taslak kaydedilemedi.' };
        }
      } else if (inserted) {
        digestId = (inserted as { id: string }).id;
      }
    }

    if (!digestId) {
      return { success: false, error: 'Taslak kimliği alınamadı.' };
    }

    const { data: row, error: readErr } = await client
      .from('teacher_weekly_digests')
      .select('id, body, status, week_start, created_at')
      .eq('id', digestId!)
      .single();

    if (readErr || !row) {
      return {
        success: true,
        data: {
          id: digestId!,
          body,
          status: 'draft',
          weekStart: weekStartStr,
          createdAt: new Date().toISOString(),
        },
      };
    }

    const r = row as {
      id: string;
      body: string;
      status: string;
      week_start: string;
      created_at: string;
    };

    revalidatePath('/teacher/dashboard');

    return {
      success: true,
      data: {
        id: r.id,
        body: r.body,
        status: r.status === 'published' ? 'published' : 'draft',
        weekStart: r.week_start,
        createdAt: r.created_at,
      },
    };
  } catch (error) {
    console.error(
      '[digest] generateStudentWeeklyDigestAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Haftalık özet oluşturulamadı.' };
  }
}

export async function publishStudentDigestAction(
  digestId: string,
  bodyOverride?: string | null,
): Promise<DigestActionResult> {
  try {
    const current = await requireApprovedTeacher();
    if (!current) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğretmen hesabı gerekiyor.',
      };
    }

    if (!UUID_PATTERN.test(digestId)) {
      return { success: false, error: 'Geçersiz özet kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: row, error: readErr } = await client
      .from('teacher_weekly_digests')
      .select('id, teacher_id, status')
      .eq('id', digestId)
      .maybeSingle();

    if (readErr || !row) {
      return { success: false, error: 'Özet bulunamadı.' };
    }

    const r = row as { teacher_id: string; status: string };

    if (r.teacher_id !== current.user.id) {
      return { success: false, error: 'Bu özet size ait değil.' };
    }

    if (r.status === 'published') {
      return { success: true };
    }

    const trimmedBody =
      typeof bodyOverride === 'string' ? bodyOverride.trim() : '';
    const updatePayload: Record<string, unknown> = {
      status: 'published',
      updated_at: new Date().toISOString(),
    };
    if (trimmedBody.length > 0) {
      updatePayload.body = trimmedBody;
    }

    const { error: upErr } = await client
      .from('teacher_weekly_digests')
      .update(updatePayload)
      .eq('id', digestId);

    if (upErr) {
      console.error('[digest] Yayınlama başarısız:', upErr.message);
      return { success: false, error: 'Özet yayınlanamadı.' };
    }

    revalidatePath('/teacher/dashboard');

    return { success: true };
  } catch (error) {
    console.error(
      '[digest] publishStudentDigestAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Özet yayınlanamadı.' };
  }
}

export async function generateStudentWeeklyDigestFormAction(
  studentId: string,
): Promise<{
  success: boolean;
  error?: string;
  data?: WeeklyDigestRow;
}> {
  const result = await generateStudentWeeklyDigestAction(studentId);
  return {
    success: result.success,
    error: result.error,
    data: result.data,
  };
}

export async function publishStudentDigestFormAction(
  digestId: string,
  bodyOverride?: string | null,
): Promise<{
  success: boolean;
  error?: string;
}> {
  const result = await publishStudentDigestAction(digestId, bodyOverride);
  return { success: result.success, error: result.error };
}
