import { assessmentPayloadFromJsonb } from '@/lib/assessment-payload';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { CurriculumCode } from '@/types/exam';

export type PublicDiagnosticPreview = {
  libraryId: string;
  title: string;
  curriculum: CurriculumCode;
  subject: string | null;
  durationMinutes: number;
};

async function getLibrariesReadClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

/**
 * Vitrin sayfası: doğrulanmış açık teşhis materyali (en güncel `exam_payload`).
 */
export async function loadPublicDiagnosticPreview(
  curriculum: CurriculumCode,
): Promise<PublicDiagnosticPreview | null> {
  const client = await getLibrariesReadClient();
  if (!client) return null;

  const { data, error } = await client
    .from('libraries')
    .select('id, title, curriculum, subject, exam_payload')
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', curriculum)
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn(
        '[test-et] Açık teşhis materyali okunamadı:',
        curriculum,
        error.message,
      );
    }
    return null;
  }

  const row = data as {
    id: string;
    title: string;
    curriculum: string;
    subject: string | null;
    exam_payload: unknown;
  };

  const exam = assessmentPayloadFromJsonb(row.exam_payload);
  const durationMinutes =
    exam?.durationMinutes && exam.durationMinutes > 0
      ? exam.durationMinutes
      : 15;

  const code = row.curriculum.trim().toUpperCase();
  if (code !== 'SAT' && code !== 'IELTS' && code !== 'CAIE') {
    return null;
  }

  return {
    libraryId: row.id,
    title: row.title,
    curriculum: code,
    subject: row.subject,
    durationMinutes,
  };
}
