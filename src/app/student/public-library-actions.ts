'use server';

import { revalidatePath } from 'next/cache';
import {
  assessmentPayloadFromJsonb,
  parseAssessmentPayload,
} from '@/lib/assessment-payload';
import { getCurrentProfile } from '@/lib/auth';
import {
  libraryHasExamCapability,
  resolveExamPayloadForLibrary,
  type PublicLibraryExamSource,
} from '@/lib/library-exam-generation';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isLibraryId } from '@/lib/uuid-patterns';
import type { AssessmentPayload, CurriculumCode } from '@/types/exam';

const ALLOWED_CURRICULA = new Set(['SAT', 'IELTS', 'CAIE']);

const DIAGNOSTIC_QUESTIONS: Record<CurriculumCode, number> = {
  SAT: 4,
  IELTS: 1,
  CAIE: 1,
};

const DEFAULT_PRACTICE_QUESTIONS: Record<CurriculumCode, number> = {
  SAT: 4,
  IELTS: 1,
  CAIE: 1,
};

export interface PublicLibraryItem {
  id: string;
  title: string;
  curriculum: string;
  subject: string | null;
  extractedText: string | null;
  createdAt: string;
  hasExam: boolean;
}

async function getProfilesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

async function requireApprovedStudent(): Promise<{ userId: string } | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'student') return null;
  if (current.profile.status !== 'approved') return null;
  return { userId: current.user.id };
}

async function readStudentCurriculums(userId: string): Promise<string[]> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!admin) return [];

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return [];
    const raw = data.user.user_metadata?.selected_curriculums;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is string =>
        typeof item === 'string' && ALLOWED_CURRICULA.has(item.toUpperCase()),
    );
  } catch {
    return [];
  }
}

function isMissingPublicLibraryColumnError(error: {
  code?: string;
  message?: string;
}): boolean {
  const haystack = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    haystack.includes('is_public') ||
    haystack.includes('verification_status') ||
    haystack.includes('exam_payload') ||
    haystack.includes('schema cache')
  );
}

function mapPublicLibraryRow(row: {
  id: string;
  title: string;
  curriculum: string;
  subject: string | null;
  extracted_text: string | null;
  created_at: string;
  exam_payload?: unknown;
}): PublicLibraryItem {
  const source: PublicLibraryExamSource = {
    title: row.title,
    curriculum: row.curriculum,
    subject: row.subject,
    extracted_text: row.extracted_text,
    exam_payload: row.exam_payload ?? null,
  };

  return {
    id: row.id,
    title: row.title,
    curriculum: row.curriculum,
    subject: row.subject,
    extractedText: row.extracted_text,
    createdAt: row.created_at,
    hasExam: libraryHasExamCapability(source),
  };
}

/**
 * Doğrulanmış açık kütüphane materyalleri.
 */
export async function getPublicLibrariesAction(curriculum?: string): Promise<{
  success: boolean;
  error?: string;
  libraries?: PublicLibraryItem[];
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu havuz için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const normalizedFilter =
      curriculum && curriculum.trim()
        ? curriculum.trim().toUpperCase()
        : null;

    if (normalizedFilter && !ALLOWED_CURRICULA.has(normalizedFilter)) {
      return { success: false, error: 'Geçersiz müfredat filtresi.' };
    }

    let query = client
      .from('libraries')
      .select(
        'id, title, curriculum, subject, extracted_text, created_at, exam_payload',
      )
      .eq('is_public', true)
      .eq('verification_status', 'verified')
      .order('created_at', { ascending: false });

    if (normalizedFilter) {
      query = query.eq('curriculum', normalizedFilter);
    }
    // Filtre yokken tüm doğrulanmış açık havuz (SAT / IELTS / CAIE) listelenir.

    let { data, error } = await query;

    if (error && isMissingPublicLibraryColumnError(error)) {
      console.warn(
        '[public-library] Şema eksik (is_public / verification_status); boş liste.',
        error.message,
      );
      return { success: true, libraries: [] };
    }

    if (error) {
      console.error('[public-library] Açık kütüphane okunamadı:', error.message);
      return { success: false, error: 'Açık kütüphane yüklenemedi.' };
    }

    const libraries = ((data ?? []) as Parameters<typeof mapPublicLibraryRow>[0][]).map(
      mapPublicLibraryRow,
    );

    return { success: true, libraries };
  } catch (error) {
    console.error(
      '[public-library] getPublicLibrariesAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Açık kütüphane yüklenemedi.' };
  }
}

async function loadVerifiedPublicLibrary(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  libraryId: string,
): Promise<
  | { ok: true; row: PublicLibraryExamSource & { id: string } }
  | { ok: false; error: string }
> {
  const { data, error } = await client
    .from('libraries')
    .select(
      'id, title, curriculum, subject, extracted_text, exam_payload, is_public, verification_status',
    )
    .eq('id', libraryId)
    .maybeSingle();

  if (error || !data) {
    console.error(
      '[START_EXAM_DEBUG]: Aranan libraryId:',
      libraryId,
      'Hata:',
      error ?? 'kayıt yok',
    );
    return { ok: false, error: 'Materyal bulunamadı.' };
  }

  const row = data as {
    id: string;
    title: string;
    curriculum: string;
    subject: string | null;
    extracted_text: string | null;
    exam_payload: unknown;
    is_public: boolean | null;
    verification_status: string | null;
  };

  if (!row.is_public || row.verification_status !== 'verified') {
    console.error('[START_EXAM_DEBUG]: Kütüphane açık havuzda değil:', {
      libraryId,
      is_public: row.is_public,
      verification_status: row.verification_status,
    });
    return { ok: false, error: 'Bu materyal açık havuzda değil.' };
  }

  return {
    ok: true,
    row: {
      id: row.id,
      title: row.title,
      curriculum: row.curriculum,
      subject: row.subject,
      extracted_text: row.extracted_text,
      exam_payload: row.exam_payload,
    },
  };
}

const SEEDED_LIBRARY_SELECT =
  'id, title, curriculum, subject, extracted_text, exam_payload';

type SeededDiagnosticLibraryRow = PublicLibraryExamSource & { id: string };

async function findSeededDiagnosticLibrary(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  primaryCurriculum: string,
): Promise<
  | { ok: true; row: SeededDiagnosticLibraryRow }
  | { ok: false; error: string }
> {
  const code = primaryCurriculum.trim().toUpperCase();
  if (!ALLOWED_CURRICULA.has(code)) {
    return { ok: false, error: 'Geçersiz hedef sınav.' };
  }

  const { data: primary, error: primaryError } = await client
    .from('libraries')
    .select(SEEDED_LIBRARY_SELECT)
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', code)
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (primaryError && isMissingPublicLibraryColumnError(primaryError)) {
    return {
      ok: false,
      error:
        'Henüz doğrulanmış açık teşhis materyali yok. Kısa süre sonra tekrar deneyin.',
    };
  }

  if (primaryError) {
    console.error(
      '[public-library] Teşhis materyali aranırken hata:',
      primaryError.message,
    );
    return { ok: false, error: 'Teşhis materyali yüklenemedi.' };
  }

  const pickRow = async (
    row: typeof primary,
  ): Promise<SeededDiagnosticLibraryRow | null> => {
    if (!row) return null;
    const parsed = row as {
      id: string;
      title: string;
      curriculum: string;
      subject: string | null;
      extracted_text: string | null;
      exam_payload: unknown;
    };
    const exam = assessmentPayloadFromJsonb(parsed.exam_payload);
    if (!exam) return null;
    return {
      id: parsed.id,
      title: parsed.title,
      curriculum: parsed.curriculum,
      subject: parsed.subject,
      extracted_text: parsed.extracted_text,
      exam_payload: exam,
    };
  };

  const primaryRow = await pickRow(primary);
  if (primaryRow) {
    return { ok: true, row: primaryRow };
  }

  const { data: satFallback, error: satError } = await client
    .from('libraries')
    .select(SEEDED_LIBRARY_SELECT)
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', 'SAT')
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (satError) {
    console.error(
      '[public-library] SAT teşhis yedeği aranırken hata:',
      satError.message,
    );
    return { ok: false, error: 'Teşhis materyali yüklenemedi.' };
  }

  const satRow = await pickRow(satFallback);
  if (satRow) {
    return { ok: true, row: satRow };
  }

  return {
    ok: false,
    error:
      'Henüz doğrulanmış açık teşhis materyali yok. Aşağıdaki hazır denemelerden birini seçebilirsin.',
  };
}

/**
 * Teşhis banner akışı: yalnızca DB'deki hazır `exam_payload` ile atama açar (LLM yok).
 */
async function startSeededDiagnosticSelfPacedExam(
  primaryCurriculum: string,
): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  const student = await requireApprovedStudent();
  if (!student) {
    return {
      success: false,
      error: 'Bu işlem için onaylı bir öğrenci hesabı gerekiyor.',
    };
  }

  const client = await getProfilesClient();
  if (!client) {
    return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
  }

  const loaded = await findSeededDiagnosticLibrary(client, primaryCurriculum);
  if (!loaded.ok) {
    return { success: false, error: loaded.error };
  }

  const { row } = loaded;
  const exam = assessmentPayloadFromJsonb(row.exam_payload);
  if (!exam) {
    return {
      success: false,
      error: 'Teşhis sınav verisi geçersiz. Lütfen hazır denemelerden birini seçin.',
    };
  }

  const inProgressId = await findInProgressSelfPracticeAssignment(
    client,
    student.userId,
    row.id,
  );
  if (inProgressId) {
    return { success: true, assignmentId: inProgressId };
  }

  const created = await insertNewSelfPacedAssignment(
    client,
    student.userId,
    row.id,
    exam,
  );
  if (!created.ok) {
    return { success: false, error: created.error };
  }

  return { success: true, assignmentId: created.assignmentId };
}

function isAssignmentUniqueViolation(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const haystack = `${error.message ?? ''}`.toLowerCase();
  return (
    haystack.includes('duplicate key') ||
    haystack.includes('unique_assignment_material_student_type')
  );
}

async function findInProgressSelfPracticeAssignment(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  studentId: string,
  libraryId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('assignments')
    .select('id')
    .eq('student_id', studentId)
    .eq('library_id', libraryId)
    .is('teacher_id', null)
    .eq('assignment_type', 'exam')
    .eq('status', 'in_progress')
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return (data as { id: string }).id;
}

async function findLatestSelfPracticeExamAssignment(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  studentId: string,
  libraryId: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await client
    .from('assignments')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('library_id', libraryId)
    .is('teacher_id', null)
    .eq('assignment_type', 'exam')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as { id: string; status: string };
  return { id: row.id, status: row.status };
}

async function insertNewSelfPacedAssignment(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  studentId: string,
  libraryId: string,
  examPayload: import('@/types/exam').AssessmentPayload,
): Promise<{ ok: true; assignmentId: string } | { ok: false; error: string }> {
  let validatedExam;
  try {
    validatedExam = parseAssessmentPayload(examPayload);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Sınav verisi doğrulanamadı.',
    };
  }

  const { data: inserted, error: insertError } = await client
    .from('assignments')
    .insert({
      library_id: libraryId,
      teacher_id: null,
      student_id: studentId,
      status: 'in_progress',
      assignment_type: 'exam',
      exam_payload: validatedExam,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    if (isAssignmentUniqueViolation(insertError ?? null)) {
      const existing = await findLatestSelfPracticeExamAssignment(
        client,
        studentId,
        libraryId,
      );

      if (existing) {
        if (existing.status !== 'in_progress') {
          const { error: reopenError } = await client
            .from('assignments')
            .update({
              status: 'in_progress',
              exam_payload: validatedExam,
            })
            .eq('id', existing.id)
            .eq('student_id', studentId);

          if (reopenError) {
            console.warn(
              '[public-library] Mevcut atama yeniden açılamadı, kimlik dönülüyor:',
              reopenError.message,
            );
          }
        }

        revalidatePath('/student/dashboard');
        return { ok: true, assignmentId: existing.id };
      }
    }

    console.error(
      '[public-library] Bağımsız atama oluşturulamadı:',
      insertError?.message,
    );
    return { ok: false, error: 'Sınav oturumu başlatılamadı.' };
  }

  revalidatePath('/student/dashboard');

  return { ok: true, assignmentId: (inserted as { id: string }).id };
}

type SelfPacedStartOptions = {
  diagnostic?: boolean;
};

/**
 * Açık havuz materyalinden bağımsız deneme başlatır.
 */
export async function startSelfPacedExamAction(
  libraryId: string,
  options?: SelfPacedStartOptions,
): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    const normalizedLibraryId = libraryId.trim();
    if (!isLibraryId(normalizedLibraryId)) {
      console.error(
        '[START_EXAM_DEBUG]: Geçersiz libraryId formatı:',
        libraryId,
      );
      return { success: false, error: 'Geçersiz materyal kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const inProgressId = await findInProgressSelfPracticeAssignment(
      client,
      student.userId,
      normalizedLibraryId,
    );
    if (inProgressId) {
      return { success: true, assignmentId: inProgressId };
    }

    const loaded = await loadVerifiedPublicLibrary(
      client,
      normalizedLibraryId,
    );
    if (!loaded.ok) {
      return { success: false, error: loaded.error };
    }

    const storedExam = assessmentPayloadFromJsonb(loaded.row.exam_payload);
    const curriculum = loaded.row.curriculum.trim().toUpperCase() as CurriculumCode;
    const questionCount = options?.diagnostic
      ? (DIAGNOSTIC_QUESTIONS[curriculum] ?? 1)
      : (DEFAULT_PRACTICE_QUESTIONS[curriculum] ??
        DEFAULT_PRACTICE_QUESTIONS.SAT);

    let examPayload: AssessmentPayload;

    if (storedExam) {
      examPayload = storedExam;
    } else {
      const examResult = await resolveExamPayloadForLibrary(
        loaded.row,
        questionCount,
      );
      if (!examResult.ok) {
        console.error('[START_EXAM_DEBUG]: Sınav payload çözülemedi:', {
          libraryId: normalizedLibraryId,
          error: examResult.error,
        });
        return { success: false, error: examResult.error };
      }
      examPayload = examResult.exam;
    }
    if (options?.diagnostic) {
      examPayload = {
        ...examPayload,
        durationMinutes:
          examPayload.durationMinutes > 0 ? examPayload.durationMinutes : 15,
      };
    }

    const created = await insertNewSelfPacedAssignment(
      client,
      student.userId,
      normalizedLibraryId,
      examPayload,
    );
    if (!created.ok) {
      return { success: false, error: created.error };
    }

    return { success: true, assignmentId: created.assignmentId };
  } catch (error) {
    console.error(
      '[public-library] startSelfPacedExamAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Sınav başlatılamadı.' };
  }
}

/**
 * Profildeki birincil hedef sınavına göre teşhis materyali seçer ve başlatır.
 */
export async function startSmartDiagnosticSelfPacedExamAction(): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    const selected = await readStudentCurriculums(student.userId);
    const primaryCurriculum = selected[0]?.toUpperCase() ?? 'SAT';

    return startSeededDiagnosticSelfPacedExam(primaryCurriculum);
  } catch (error) {
    console.error(
      '[public-library] startSmartDiagnosticSelfPacedExamAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Teşhis sınavı başlatılamadı.' };
  }
}

/** @deprecated Akıllı teşhis için `startSmartDiagnosticSelfPacedExamAction` kullanın. */
export async function startDiagnosticSelfPacedExamAction(
  curriculum: string,
): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  try {
    const code = curriculum.trim().toUpperCase();
    if (!ALLOWED_CURRICULA.has(code)) {
      return { success: false, error: 'Geçersiz hedef sınav.' };
    }

    return startSeededDiagnosticSelfPacedExam(code);
  } catch (error) {
    console.error(
      '[public-library] startDiagnosticSelfPacedExamAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Teşhis sınavı başlatılamadı.' };
  }
}

export async function startSelfPacedExamFormAction(
  libraryId: string,
): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  return startSelfPacedExamAction(libraryId);
}

export async function startDiagnosticSelfPacedExamFormAction(
  curriculum: string,
): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  return startDiagnosticSelfPacedExamAction(curriculum);
}

export async function startSmartDiagnosticSelfPacedExamFormAction(): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  return startSmartDiagnosticSelfPacedExamAction();
}
