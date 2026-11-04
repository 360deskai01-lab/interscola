import { assessmentPayloadFromJsonb } from '@/lib/assessment-payload';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import { CAIE_ANDRADE_DIAGNOSTIC_EXAM } from '@/lib/test-et/caie-andrade-seed';
import {
  isCaieTestEtContext,
  type TestEtSlug,
} from '@/lib/test-et/test-et-config';
import type { AssessmentPayload, CurriculumCode } from '@/types/exam';

const CAIE_CURRICULUM_DB_ALIASES = ['CAIE', 'A_LEVEL', 'A-Level'] as const;

const CAIE_TITLE_OR =
  'title.ilike.%Andrade%,title.ilike.%A-Level%,title.ilike.%CAIE%';

async function getLibrariesReadClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

async function loadCaieGuestExamFromDatabase(): Promise<AssessmentPayload | null> {
  const client = await getLibrariesReadClient();
  if (!client) return null;

  const { data: byCurriculum, error: curriculumError } = await client
    .from('libraries')
    .select('exam_payload, is_public, verification_status, title, curriculum')
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .in('curriculum', [...CAIE_CURRICULUM_DB_ALIASES])
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(12);

  if (!curriculumError && byCurriculum?.length) {
    for (const row of byCurriculum) {
      const exam = assessmentPayloadFromJsonb(
        (row as { exam_payload: unknown }).exam_payload,
      );
      if (exam) return exam;
    }
  }

  const { data: byTitle, error: titleError } = await client
    .from('libraries')
    .select('exam_payload, is_public, verification_status')
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .not('exam_payload', 'is', null)
    .or(CAIE_TITLE_OR)
    .order('created_at', { ascending: false })
    .limit(12);

  if (titleError || !byTitle?.length) {
    return null;
  }

  for (const row of byTitle) {
    const exam = assessmentPayloadFromJsonb(
      (row as { exam_payload: unknown }).exam_payload,
    );
    if (exam) return exam;
  }

  return null;
}

/** CAIE / a-level misafir: DB ne olursa olsun Andrade statik payload garantisi. */
export function getCaieGuestExamFallback(): AssessmentPayload {
  return CAIE_ANDRADE_DIAGNOSTIC_EXAM;
}

async function loadCaieGuestExamGuaranteed(): Promise<AssessmentPayload> {
  const fromDb = await loadCaieGuestExamFromDatabase();
  return fromDb ?? getCaieGuestExamFallback();
}

async function loadStandardGuestExam(
  curriculum: 'SAT' | 'IELTS',
): Promise<AssessmentPayload | null> {
  const client = await getLibrariesReadClient();
  if (!client) return null;

  const { data, error } = await client
    .from('libraries')
    .select('exam_payload')
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', curriculum)
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return assessmentPayloadFromJsonb(
    (data as { exam_payload: unknown }).exam_payload,
  );
}

export type LoadGuestDiagnosticExamInput = {
  curriculum: CurriculumCode;
  slug?: TestEtSlug;
};

/**
 * Misafir teşhis: oturum gerektirmez.
 * CAIE / a-level için dönüş asla null değildir.
 */
export async function loadGuestDiagnosticExam(
  input: LoadGuestDiagnosticExamInput | CurriculumCode,
): Promise<AssessmentPayload | null> {
  const normalized: LoadGuestDiagnosticExamInput =
    typeof input === 'string' ? { curriculum: input } : input;

  const { curriculum, slug } = normalized;

  if (isCaieTestEtContext({ slug, curriculum })) {
    return loadCaieGuestExamGuaranteed();
  }

  if (curriculum === 'SAT' || curriculum === 'IELTS') {
    return loadStandardGuestExam(curriculum);
  }

  return null;
}
