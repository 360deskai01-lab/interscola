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
import {
  ATTEMPTS_TABLE,
  getSupabaseAdmin,
  PROFILES_SCHEMA,
} from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import { isLibraryId } from '@/lib/uuid-patterns';
import {
  FULL_MOCK_MIN_DURATION_MINUTES,
  displayDurationMinutes,
  resolveLibraryExamFormat,
  type LibraryExamFormat,
} from '@/lib/exam/library-exam-format';
import { resolveDiagnosticLibrary } from '@/lib/test-et/resolve-diagnostic-library';
import {
  decorateExamForSessionFormat,
  questionCountForSessionFormat,
  type ExamSessionFormatId,
} from '@/lib/exam/exam-session-formats';
import type { AssessmentPayload, CurriculumCode } from '@/types/exam';

const ALLOWED_CURRICULA = new Set(['SAT', 'IELTS', 'CAIE']);

export interface PublicLibraryItem {
  id: string;
  title: string;
  curriculum: string;
  subject: string | null;
  extractedText: string | null;
  createdAt: string;
  hasExam: boolean;
  /** `libraries.exam_format` (veya soru sayısından çıkarım). */
  examFormat: LibraryExamFormat;
  /** Hazır `exam_payload` içindeki soru sayısı (yoksa null). */
  storedQuestionCount: number | null;
  /** Hazır `exam_payload` süresi (dk); yoksa null. */
  storedDurationMinutes: number | null;
  /** Tam simülasyon kartı için gösterilecek süre (dk). */
  fullMockDurationMinutes: number;
  /** Öğrencinin bu materyalde daha önce aldığı en son sonuç (yoksa null). */
  lastResult: PublicLibraryLastResult | null;
}

export interface PublicLibraryLastResult {
  /** Tamamlanmış oturum var mı? */
  solved: boolean;
  scaledResult: string | null;
  attemptedAt: string | null;
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

function mapPublicLibraryRow(
  row: {
    id: string;
    title: string;
    curriculum: string;
    subject: string | null;
    extracted_text: string | null;
    created_at: string;
    exam_payload?: unknown;
    exam_format?: unknown;
  },
  lastResult: PublicLibraryLastResult | null,
): PublicLibraryItem {
  const source: PublicLibraryExamSource = {
    title: row.title,
    curriculum: row.curriculum,
    subject: row.subject,
    extracted_text: row.extracted_text,
    exam_payload: row.exam_payload ?? null,
  };

  const stored = assessmentPayloadFromJsonb(row.exam_payload ?? null);
  const storedQuestionCount = stored?.questions.length ?? null;
  const storedDurationMinutes =
    stored && Number.isFinite(stored.durationMinutes)
      ? stored.durationMinutes
      : null;
  const examFormat = resolveLibraryExamFormat(
    row.exam_format,
    storedQuestionCount,
  );

  return {
    id: row.id,
    title: row.title,
    curriculum: row.curriculum,
    subject: row.subject,
    extractedText: row.extracted_text,
    createdAt: row.created_at,
    hasExam: libraryHasExamCapability(source),
    examFormat,
    storedQuestionCount,
    storedDurationMinutes,
    fullMockDurationMinutes: displayDurationMinutes(
      'full_mock',
      storedDurationMinutes,
    ),
    lastResult,
  };
}

/**
 * Öğrencinin kendi başlattığı (öğretmensiz) denemelerinden materyal başına
 * en son sonucu çıkarır. Hata durumunda boş harita döner: rozet eksik kalır,
 * kütüphane listesi bozulmaz.
 */
async function loadLastResultsByLibrary(
  client: NonNullable<Awaited<ReturnType<typeof getProfilesClient>>>,
  studentId: string,
  libraryIds: string[],
): Promise<Map<string, PublicLibraryLastResult>> {
  const out = new Map<string, PublicLibraryLastResult>();
  if (libraryIds.length === 0) return out;

  const { data: assignmentRows, error: assignmentError } = await client
    .from('assignments')
    .select('id, library_id, status')
    .eq('student_id', studentId)
    .is('teacher_id', null)
    .eq('assignment_type', 'exam')
    .in('library_id', libraryIds);

  if (assignmentError) {
    console.error(
      '[public-library] Çözüm geçmişi okunamadı:',
      assignmentError.message,
    );
    return out;
  }

  const assignments = (assignmentRows ?? []) as {
    id: string;
    library_id: string | null;
    status: string;
  }[];
  if (assignments.length === 0) return out;

  const libraryByAssignment = new Map<string, string>();
  for (const row of assignments) {
    if (!row.library_id) continue;
    libraryByAssignment.set(row.id, row.library_id);
    if (row.status === 'completed') {
      out.set(row.library_id, {
        solved: true,
        scaledResult: null,
        attemptedAt: null,
      });
    }
  }

  const attemptsClient = getSupabaseAdmin('interscola');
  if (!attemptsClient) return out;

  const { data: attemptRows, error: attemptsError } = await attemptsClient
    .from(ATTEMPTS_TABLE)
    .select('assignment_id, scaled_result, created_at')
    .in('assignment_id', [...libraryByAssignment.keys()])
    .order('created_at', { ascending: false });

  if (attemptsError) {
    console.error(
      '[public-library] Deneme skorları okunamadı:',
      attemptsError.message,
    );
    return out;
  }

  const seen = new Set<string>();
  for (const attempt of attemptRows ?? []) {
    const item = attempt as {
      assignment_id: string | null;
      scaled_result: string | null;
      created_at: string | null;
    };
    const libraryId = item.assignment_id
      ? libraryByAssignment.get(item.assignment_id)
      : undefined;
    if (!libraryId || seen.has(libraryId)) continue;
    seen.add(libraryId);
    out.set(libraryId, {
      solved: true,
      scaledResult:
        typeof item.scaled_result === 'string' && item.scaled_result.trim()
          ? item.scaled_result.trim()
          : null,
      attemptedAt: item.created_at ?? null,
    });
  }

  return out;
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

    const buildQuery = (columns: string) => {
      let query = client
        .from('libraries')
        .select(columns)
        .eq('is_public', true)
        .eq('verification_status', 'verified')
        .order('created_at', { ascending: false });

      if (normalizedFilter) {
        query = query.eq('curriculum', normalizedFilter);
      }
      // Filtre yokken tüm doğrulanmış açık havuz (SAT / IELTS / CAIE) listelenir.
      return query;
    };

    const baseColumns =
      'id, title, curriculum, subject, extracted_text, created_at, exam_payload';

    // FAZ C migration'ı uygulanmamışsa `exam_format` yoktur: havuzu kaybetmeden
    // eski sütun kümesiyle yeniden dene (format soru sayısından çıkarılır).
    let { data, error } = await buildQuery(`${baseColumns}, exam_format`);
    if (error?.code === '42703') {
      console.warn(
        '[public-library] exam_format sütunu yok; soru sayısından çıkarım yapılacak.',
      );
      ({ data, error } = await buildQuery(baseColumns));
    }

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

    const rows = (data ?? []) as unknown as Parameters<
      typeof mapPublicLibraryRow
    >[0][];
    const lastResults = await loadLastResultsByLibrary(
      client,
      student.userId,
      rows.map((row) => row.id),
    );
    const libraries = rows.map((row) =>
      mapPublicLibraryRow(row, lastResults.get(row.id) ?? null),
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

  try {
    const resolved = await resolveDiagnosticLibrary(
      client,
      code as CurriculumCode,
    );
    return {
      ok: true,
      row: {
        id: resolved.id,
        title: resolved.title,
        curriculum: resolved.curriculum,
        subject: resolved.subject,
        extracted_text: resolved.extracted_text,
        exam_payload: resolved.exam,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Teşhis materyali yüklenemedi.';
    console.error('[public-library] Teşhis materyali çözülemedi:', message);
    return {
      ok: false,
      error:
        code === 'CAIE'
          ? 'A-Level teşhis materyali yüklenemedi. Lütfen tekrar deneyin.'
          : message,
    };
  }
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

  const curriculum = primaryCurriculum.trim().toUpperCase() as CurriculumCode;
  const decorated = decorateExamForSessionFormat(
    exam,
    'diagnostic_drill',
    curriculum,
  );

  const created = await insertNewSelfPacedAssignment(
    client,
    student.userId,
    row.id,
    decorated,
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
  format?: ExamSessionFormatId;
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
    const sessionFormat: ExamSessionFormatId =
      options?.format ?? 'mini_mock';
    const questionCount = questionCountForSessionFormat(
      sessionFormat,
      curriculum,
    );

    let examPayload: AssessmentPayload;

    const poolReady =
      storedExam &&
      storedExam.questions.length > 0 &&
      (storedExam.questions.length >= questionCount ||
        storedExam.questions.length >= 10);

    if (poolReady) {
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

    examPayload = decorateExamForSessionFormat(
      examPayload,
      sessionFormat,
      curriculum,
    );

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
 * Resmi tam simülasyon: hazır `exam_payload` kırpılmadan açılır (LLM üretimi yok).
 * Mini/drill akışından farkı: soru sayısı kısaltılmaz, süre en az 120 dk tutulur.
 */
export async function startSelfPacedFullMockAction(libraryId: string): Promise<{
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

    const loaded = await loadVerifiedPublicLibrary(client, normalizedLibraryId);
    if (!loaded.ok) {
      return { success: false, error: loaded.error };
    }

    const storedExam = assessmentPayloadFromJsonb(loaded.row.exam_payload);
    if (!storedExam || storedExam.questions.length === 0) {
      return {
        success: false,
        error: 'Bu tam simülasyonun sınav verisi henüz hazır değil.',
      };
    }

    const examPayload: AssessmentPayload = {
      ...storedExam,
      durationMinutes: Math.max(
        storedExam.durationMinutes,
        FULL_MOCK_MIN_DURATION_MINUTES,
      ),
    };

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
      '[public-library] startSelfPacedFullMockAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Tam simülasyon başlatılamadı.' };
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
  return startSelfPacedExamAction(libraryId, { format: 'mini_mock' });
}

export async function startSelfPacedDiagnosticDrillFormAction(
  libraryId: string,
): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  return startSelfPacedExamAction(libraryId, { format: 'diagnostic_drill' });
}

export async function startSelfPacedFullMockFormAction(
  libraryId: string,
): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
}> {
  return startSelfPacedFullMockAction(libraryId);
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
