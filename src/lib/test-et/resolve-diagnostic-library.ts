import { assessmentPayloadFromJsonb, parseAssessmentPayload } from '@/lib/assessment-payload';
import {
  CAIE_ANDRADE_DIAGNOSTIC_EXAM,
  CAIE_ANDRADE_LIBRARY_TITLE,
  CAIE_ANDRADE_SEED_LIBRARY_ID,
} from '@/lib/test-et/caie-andrade-seed';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssessmentPayload, CurriculumCode } from '@/types/exam';

const LIBRARY_SELECT =
  'id, title, curriculum, subject, extracted_text, exam_payload, is_public, verification_status';

const CAIE_CURRICULUM_ALIASES = ['CAIE', 'A_LEVEL', 'A-Level'] as const;

type LibraryRow = {
  id: string;
  title: string;
  curriculum: string;
  subject: string | null;
  extracted_text: string | null;
  exam_payload: unknown;
  is_public?: boolean | null;
  verification_status?: string | null;
};

export type ResolvedDiagnosticLibrary = {
  id: string;
  title: string;
  curriculum: CurriculumCode;
  subject: string | null;
  extracted_text: string | null;
  exam: AssessmentPayload;
  source: 'database' | 'static_fallback';
};

function normalizeCurriculumCode(raw: string): CurriculumCode | null {
  const upper = raw.trim().toUpperCase();
  if (upper === 'SAT' || upper === 'IELTS' || upper === 'CAIE') {
    return upper;
  }
  if (upper === 'A_LEVEL' || upper === 'A-LEVEL') {
    return 'CAIE';
  }
  return null;
}

function scoreCaieTitlePriority(title: string): number {
  const t = title.toLowerCase();
  if (t.includes('andrade')) return 3;
  if (t.includes('a-level') || t.includes('a level')) return 2;
  if (t.includes('caie')) return 1;
  return 0;
}

function rowToResolved(row: LibraryRow): ResolvedDiagnosticLibrary | null {
  if (row.is_public === false) return null;
  if (
    row.verification_status != null &&
    row.verification_status !== 'verified'
  ) {
    return null;
  }

  const exam = assessmentPayloadFromJsonb(row.exam_payload);
  if (!exam) return null;

  const curriculum = normalizeCurriculumCode(row.curriculum) ?? exam.curriculum;
  if (curriculum !== 'SAT' && curriculum !== 'IELTS' && curriculum !== 'CAIE') {
    return null;
  }

  try {
    parseAssessmentPayload(exam);
  } catch {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    curriculum,
    subject: row.subject,
    extracted_text: row.extracted_text,
    exam,
    source: 'database',
  };
}

function pickBestCaieRow(rows: LibraryRow[]): ResolvedDiagnosticLibrary | null {
  const candidates: ResolvedDiagnosticLibrary[] = [];
  for (const row of rows) {
    const resolved = rowToResolved(row);
    if (resolved) candidates.push(resolved);
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const scoreDiff =
      scoreCaieTitlePriority(b.title) - scoreCaieTitlePriority(a.title);
    if (scoreDiff !== 0) return scoreDiff;
    return a.title.localeCompare(b.title);
  });

  return candidates[0] ?? null;
}

async function queryCaieDiagnosticFromDatabase(
  client: SupabaseClient,
): Promise<ResolvedDiagnosticLibrary | null> {
  const { data: byCurriculum, error: curriculumError } = await client
    .from('libraries')
    .select(LIBRARY_SELECT)
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .in('curriculum', [...CAIE_CURRICULUM_ALIASES])
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(24);

  if (!curriculumError && byCurriculum?.length) {
    const picked = pickBestCaieRow(byCurriculum as LibraryRow[]);
    if (picked) return picked;
  }

  const { data: byTitle, error: titleError } = await client
    .from('libraries')
    .select(LIBRARY_SELECT)
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .not('exam_payload', 'is', null)
    .or(
      'title.ilike.%Andrade%,title.ilike.%A-Level%,title.ilike.%CAIE%',
    )
    .order('created_at', { ascending: false })
    .limit(24);

  if (titleError || !byTitle?.length) {
    return null;
  }

  return pickBestCaieRow(byTitle as LibraryRow[]);
}

async function queryStandardCurriculumFromDatabase(
  client: SupabaseClient,
  curriculum: 'SAT' | 'IELTS',
): Promise<ResolvedDiagnosticLibrary | null> {
  const { data, error } = await client
    .from('libraries')
    .select(LIBRARY_SELECT)
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', curriculum)
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return rowToResolved(data as LibraryRow);
}

function caieStaticFallback(): ResolvedDiagnosticLibrary {
  return {
    id: CAIE_ANDRADE_SEED_LIBRARY_ID,
    title: CAIE_ANDRADE_LIBRARY_TITLE,
    curriculum: 'CAIE',
    subject: CAIE_ANDRADE_DIAGNOSTIC_EXAM.subject,
    extracted_text: null,
    exam: CAIE_ANDRADE_DIAGNOSTIC_EXAM,
    source: 'static_fallback',
  };
}

/** Statik fallback ataması için kütüphane satırının varlığını dener (service role). */
export async function ensureCaieAndradeSeedLibraryRow(): Promise<string> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!admin) {
    return CAIE_ANDRADE_SEED_LIBRARY_ID;
  }

  const { data: existing } = await admin
    .from('libraries')
    .select('id')
    .eq('id', CAIE_ANDRADE_SEED_LIBRARY_ID)
    .maybeSingle();

  if (existing?.id) {
    return CAIE_ANDRADE_SEED_LIBRARY_ID;
  }

  const { data: inserted, error } = await admin.from('libraries').upsert(
    {
      id: CAIE_ANDRADE_SEED_LIBRARY_ID,
      title: CAIE_ANDRADE_LIBRARY_TITLE,
      curriculum: 'CAIE',
      subject: CAIE_ANDRADE_DIAGNOSTIC_EXAM.subject,
      extracted_text:
        'Cambridge International A Level Psychology 9990 — Andrade (2010) doodling study teşhis.',
      exam_payload: CAIE_ANDRADE_DIAGNOSTIC_EXAM,
      is_public: true,
      verification_status: 'verified',
      teacher_id: null,
    },
    { onConflict: 'id' },
  ).select('id').maybeSingle();

  if (error) {
    console.warn('[test-et] CAIE tohum kütüphanesi upsert edilemedi:', error.message);
    return CAIE_ANDRADE_SEED_LIBRARY_ID;
  }

  return (inserted as { id: string } | null)?.id ?? CAIE_ANDRADE_SEED_LIBRARY_ID;
}

export async function resolveDiagnosticLibrary(
  client: SupabaseClient,
  curriculum: CurriculumCode,
): Promise<ResolvedDiagnosticLibrary> {
  if (curriculum === 'CAIE') {
    const fromDb = await queryCaieDiagnosticFromDatabase(client);
    if (fromDb) return fromDb;

    const fallback = caieStaticFallback();
    const libraryId = await ensureCaieAndradeSeedLibraryRow();
    return { ...fallback, id: libraryId };
  }

  const fromDb = await queryStandardCurriculumFromDatabase(client, curriculum);
  if (fromDb) return fromDb;

  if (curriculum === 'SAT') {
    throw new Error('SAT teşhis materyali bulunamadı.');
  }

  throw new Error('IELTS teşhis materyali bulunamadı.');
}
