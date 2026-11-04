import {
  CAIE_ANDRADE_DIAGNOSTIC_EXAM,
  CAIE_ANDRADE_LIBRARY_TITLE,
  CAIE_ANDRADE_SEED_LIBRARY_ID,
} from '@/lib/test-et/caie-andrade-seed';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import { resolveDiagnosticLibrary } from '@/lib/test-et/resolve-diagnostic-library';
import type { CurriculumCode } from '@/types/exam';

function caiePreviewFallback(): PublicDiagnosticPreview {
  return {
    libraryId: CAIE_ANDRADE_SEED_LIBRARY_ID,
    title: CAIE_ANDRADE_LIBRARY_TITLE,
    curriculum: 'CAIE',
    subject: CAIE_ANDRADE_DIAGNOSTIC_EXAM.subject,
    durationMinutes: CAIE_ANDRADE_DIAGNOSTIC_EXAM.durationMinutes,
    source: 'static_fallback',
  };
}

export type PublicDiagnosticPreview = {
  libraryId: string;
  title: string;
  curriculum: CurriculumCode;
  subject: string | null;
  durationMinutes: number;
  source: 'database' | 'static_fallback';
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
  if (!client) {
    return curriculum === 'CAIE' ? caiePreviewFallback() : null;
  }

  try {
    const resolved = await resolveDiagnosticLibrary(client, curriculum);
    const durationMinutes =
      resolved.exam.durationMinutes > 0 ? resolved.exam.durationMinutes : 15;

    return {
      libraryId: resolved.id,
      title: resolved.title,
      curriculum: resolved.curriculum,
      subject: resolved.subject,
      durationMinutes,
      source: resolved.source,
    };
  } catch (error) {
    console.warn(
      '[test-et] Açık teşhis materyali okunamadı:',
      curriculum,
      error instanceof Error ? error.message : String(error),
    );
    if (curriculum === 'CAIE') {
      return caiePreviewFallback();
    }
    return null;
  }
}
