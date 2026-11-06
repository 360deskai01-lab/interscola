'use server';

import { revalidatePath } from 'next/cache';
import {
  ModelOutputError,
  ProviderError,
  QuestionCountMismatchError,
  runGenerateExam,
  type GenerateExamRequest,
} from '@/app/api/generate-exam/route';
import {
  hasStoredExamPayload,
  parseAssessmentPayload,
} from '@/lib/assessment-payload';
import { getCurrentProfile, type ProfileRecord } from '@/lib/auth';
import { ATTEMPTS_TABLE, getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import type {
  AssessmentPayload,
  CurriculumCode,
  EngineType,
} from '@/types/exam';

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export interface LibraryActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface LibraryItem {
  id: string;
  title: string;
  curriculum: string;
  subject: string | null;
  extractedText: string | null;
  createdAt: string;
}

export interface CreateLibraryInput {
  title: string;
  curriculum: string;
  subject?: string;
  extracted_text?: string;
}

const ALLOWED_CURRICULA = new Set(['SAT', 'IELTS', 'CAIE']);

const MIN_LIBRARY_EXAM_QUESTIONS = 1;
const MAX_LIBRARY_EXAM_QUESTIONS = 5;

const MIN_EXTRACTED_TEXT_CHARS = 40;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIBRARY_EXAM_MODE: Record<
  CurriculumCode,
  { engineType: EngineType; defaultSubject: string; maxQuestions: number }
> = {
  SAT: {
    engineType: 'OBJECTIVE',
    defaultSubject: 'Reading & Writing',
    maxQuestions: 12,
  },
  IELTS: {
    engineType: 'LANGUAGE',
    defaultSubject: 'Academic Writing Task 2',
    maxQuestions: 2,
  },
  CAIE: {
    engineType: 'RUBRIC_ESSAY',
    defaultSubject: 'Psychology 9990',
    maxQuestions: 3,
  },
};

type LibraryRow = {
  id: string;
  teacher_id: string;
  title: string;
  curriculum: string;
  subject: string | null;
  extracted_text: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Yetki & istemci
// ---------------------------------------------------------------------------

async function requireApprovedTeacher(): Promise<ProfileRecord | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.status !== 'approved') return null;
  if (current.profile.role !== 'teacher' && current.profile.role !== 'admin') {
    return null;
  }
  return current.profile;
}

async function getProfilesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

function mapLibraryRow(row: LibraryRow): LibraryItem {
  return {
    id: row.id,
    title: row.title,
    curriculum: row.curriculum,
    subject: row.subject,
    extractedText: row.extracted_text,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Kütüphane CRUD
// ---------------------------------------------------------------------------

export async function createLibraryItemAction(
  data: CreateLibraryInput,
): Promise<LibraryActionResult<LibraryItem>> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğretmen hesabı gerekiyor.',
      };
    }

    const title = data.title?.trim() ?? '';
    const curriculum = data.curriculum?.trim().toUpperCase() ?? '';

    if (title.length < 2) {
      return { success: false, error: 'Materyal başlığı en az 2 karakter olmalı.' };
    }

    if (!ALLOWED_CURRICULA.has(curriculum)) {
      return {
        success: false,
        error: 'Hedef sınav SAT, IELTS veya CAIE olmalı.',
      };
    }

    const subject =
      typeof data.subject === 'string' && data.subject.trim()
        ? data.subject.trim()
        : null;
    const extractedText =
      typeof data.extracted_text === 'string' && data.extracted_text.trim()
        ? data.extracted_text.trim()
        : null;

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: inserted, error } = await client
      .from('libraries')
      .insert({
        teacher_id: teacher.id,
        title,
        curriculum,
        subject,
        extracted_text: extractedText,
      })
      .select(
        'id, teacher_id, title, curriculum, subject, extracted_text, created_at',
      )
      .single();

    if (error || !inserted) {
      console.error('[library] Materyal eklenemedi:', error?.message);
      return { success: false, error: 'Materyal kaydedilemedi.' };
    }

    revalidatePath('/teacher/dashboard');

    return {
      success: true,
      data: mapLibraryRow(inserted as LibraryRow),
    };
  } catch (error) {
    console.error(
      '[library] createLibraryItemAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function getTeacherLibraryAction(): Promise<
  LibraryActionResult<LibraryItem[]>
> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Kütüphane için onaylı öğretmen hesabı gerekiyor.',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data, error } = await client
      .from('libraries')
      .select(
        'id, teacher_id, title, curriculum, subject, extracted_text, created_at',
      )
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[library] Kütüphane okunamadı:', error.message);
      return { success: false, error: 'Materyal listesi okunamadı.' };
    }

    const items = ((data ?? []) as LibraryRow[]).map(mapLibraryRow);

    return { success: true, data: items };
  } catch (error) {
    console.error(
      '[library] getTeacherLibraryAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Kütüphane yüklenemedi.' };
  }
}

// ---------------------------------------------------------------------------
// Öğrenciye atama
// ---------------------------------------------------------------------------

async function isActiveStudentOfTeacher(
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
    console.error('[library] Öğrenci bağlantısı doğrulanamadı:', error.message);
    return false;
  }

  return Boolean(data);
}

export type AssignmentType = 'study' | 'exam';

export async function assignStudyMaterialAction(
  libraryId: string,
  studentId: string,
): Promise<LibraryActionResult> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğretmen hesabı gerekiyor.',
      };
    }

    if (typeof libraryId !== 'string' || libraryId.trim().length === 0) {
      return { success: false, error: 'Geçersiz materyal kimliği.' };
    }

    if (typeof studentId !== 'string' || studentId.trim().length === 0) {
      return { success: false, error: 'Lütfen bir öğrenci seç.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: library, error: libraryError } = await client
      .from('libraries')
      .select('id, teacher_id')
      .eq('id', libraryId)
      .maybeSingle();

    if (libraryError) {
      console.error('[library] Materyal okunamadı:', libraryError.message);
      return { success: false, error: 'Materyal bulunamadı.' };
    }

    if (!library) {
      return { success: false, error: 'Materyal bulunamadı.' };
    }

    if ((library as { teacher_id: string }).teacher_id !== teacher.id) {
      console.warn(
        '[library] Yetkisiz atama denemesi:',
        teacher.email,
        '->',
        libraryId,
      );
      return { success: false, error: 'Bu materyal size ait değil.' };
    }

    const linked = await isActiveStudentOfTeacher(
      client,
      teacher.id,
      studentId,
    );
    if (!linked) {
      return {
        success: false,
        error: 'Seçilen öğrenci sizin aktif öğrenci listenizde değil.',
      };
    }

    const duplicateMessage =
      'Bu materyalin çalışma notu bu öğrenciye zaten atanmış.';

    const { data: existingAssignment, error: duplicateError } = await client
      .from('assignments')
      .select('id')
      .eq('library_id', libraryId)
      .eq('student_id', studentId)
      .eq('assignment_type', 'study')
      .maybeSingle();

    if (duplicateError) {
      console.error(
        '[library] Mükerrer atama kontrolü başarısız:',
        duplicateError.message,
      );
    } else if (existingAssignment) {
      return { success: false, error: duplicateMessage };
    }

    const { error: insertError } = await client.from('assignments').insert({
      library_id: libraryId,
      teacher_id: teacher.id,
      student_id: studentId,
      status: 'assigned',
      assignment_type: 'study',
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return { success: false, error: duplicateMessage };
      }
      console.error('[library] Atama kaydedilemedi:', insertError.message);
      return { success: false, error: 'Materyal atanamadı.' };
    }

    revalidatePath('/teacher/dashboard');
    revalidatePath('/student/dashboard');

    return { success: true };
  } catch (error) {
    console.error(
      '[library] assignStudyMaterialAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/** @deprecated Köprü — yeni kod `assignStudyMaterialAction` kullanmalı. */
export async function assignMaterialAction(
  libraryId: string,
  studentId: string,
): Promise<LibraryActionResult> {
  return assignStudyMaterialAction(libraryId, studentId);
}

function mapGenerateExamFailure(error: unknown): string {
  if (error instanceof ProviderError) {
    if (error.statusCode === 403) {
      return (
        'DeepSeek API yetkilendirme hatası (403). DEEPSEEK_API_KEY değerini kontrol edin.'
      );
    }
    if (error.statusCode === 429) {
      return 'DeepSeek API kullanım kotası veya hız sınırı aşıldı (429).';
    }
    return 'Sınav motoru şu anda yoğun; birkaç saniye sonra tekrar deneyin.';
  }

  if (error instanceof QuestionCountMismatchError) {
    return 'Model istenen sayıda soru üretemedi. Soru sayısını düşürüp tekrar deneyin.';
  }

  if (error instanceof ModelOutputError) {
    return 'Model beklenen sınav formatına uymayan bir yanıt üretti.';
  }

  if (error instanceof Error && error.message.includes('DEEPSEEK_API_KEY')) {
    return error.message;
  }

  return 'Sınav üretilirken beklenmeyen bir hata oluştu.';
}

/**
 * Kütüphane materyalindeki metinden resmi formatta sınav üretir.
 */
export async function generateExamFromLibraryAction(
  libraryId: string,
  questionCount: number,
): Promise<LibraryActionResult<AssessmentPayload>> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğretmen hesabı gerekiyor.',
      };
    }

    if (!UUID_PATTERN.test(libraryId)) {
      return { success: false, error: 'Geçersiz materyal kimliği.' };
    }

    const clampedCount = Math.min(
      MAX_LIBRARY_EXAM_QUESTIONS,
      Math.max(
        MIN_LIBRARY_EXAM_QUESTIONS,
        Number.isFinite(questionCount) ? Math.trunc(questionCount) : 1,
      ),
    );

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: library, error: libraryError } = await client
      .from('libraries')
      .select('id, teacher_id, title, curriculum, subject, extracted_text')
      .eq('id', libraryId)
      .maybeSingle();

    if (libraryError) {
      console.error('[library] Materyal okunamadı:', libraryError.message);
      return { success: false, error: 'Materyal bulunamadı.' };
    }

    if (!library) {
      return { success: false, error: 'Materyal bulunamadı.' };
    }

    type LibraryExamRow = {
      id: string;
      teacher_id: string;
      title: string;
      curriculum: string;
      subject: string | null;
      extracted_text: string | null;
    };

    const row = library as LibraryExamRow;

    if (row.teacher_id !== teacher.id) {
      console.warn(
        '[library] Yetkisiz sınav üretimi:',
        teacher.email,
        '->',
        libraryId,
      );
      return { success: false, error: 'Bu materyal size ait değil.' };
    }

    const curriculum = row.curriculum.trim().toUpperCase();
    if (!ALLOWED_CURRICULA.has(curriculum)) {
      return { success: false, error: 'Materyalin hedef sınavı desteklenmiyor.' };
    }

    const extracted = row.extracted_text?.trim() ?? '';
    if (extracted.length < MIN_EXTRACTED_TEXT_CHARS) {
      return {
        success: false,
        error:
          'Sınav üretmek için materyalde yeterli metin olmalı. Not / Metin alanına okuma parçası veya ders içeriği ekleyin.',
      };
    }

    const mode = LIBRARY_EXAM_MODE[curriculum as CurriculumCode];
    if (!mode) {
      return { success: false, error: 'Bu müfredat için sınav modu tanımlı değil.' };
    }

    const subject =
      (row.subject?.trim() || mode.defaultSubject || row.title).trim() ||
      row.title;

    const input: GenerateExamRequest = {
      curriculum: curriculum as CurriculumCode,
      engineType: mode.engineType,
      subject,
      questionCount: Math.min(clampedCount, mode.maxQuestions),
      promptContext: extracted,
    };

    const exam = await runGenerateExam(input);

    if (!exam.questions?.length) {
      return { success: false, error: 'Üretilen sınav geçersiz (soru yok).' };
    }

    return { success: true, data: exam };
  } catch (error) {
    console.error(
      '[library] generateExamFromLibraryAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: mapGenerateExamFailure(error) };
  }
}

/**
 * Üretilmiş sınav payload'ını öğrenciye atar (`exam_payload` JSONB ile).
 */
export async function assignGeneratedExamAction(
  libraryId: string,
  studentId: string,
  examPayload: AssessmentPayload,
): Promise<LibraryActionResult> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğretmen hesabı gerekiyor.',
      };
    }

    if (!UUID_PATTERN.test(libraryId)) {
      return { success: false, error: 'Geçersiz materyal kimliği.' };
    }

    if (!UUID_PATTERN.test(studentId)) {
      return { success: false, error: 'Geçersiz öğrenci kimliği.' };
    }

    let validatedExam: AssessmentPayload;
    try {
      validatedExam = parseAssessmentPayload(examPayload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sınav verisi doğrulanamadı.';
      return { success: false, error: message };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: library, error: libraryError } = await client
      .from('libraries')
      .select('id, teacher_id')
      .eq('id', libraryId)
      .maybeSingle();

    if (libraryError) {
      console.error('[library] Materyal okunamadı:', libraryError.message);
      return { success: false, error: 'Materyal bulunamadı.' };
    }

    if (!library) {
      return { success: false, error: 'Materyal bulunamadı.' };
    }

    if ((library as { teacher_id: string }).teacher_id !== teacher.id) {
      return { success: false, error: 'Bu materyal size ait değil.' };
    }

    const linked = await isActiveStudentOfTeacher(
      client,
      teacher.id,
      studentId,
    );
    if (!linked) {
      return {
        success: false,
        error: 'Seçilen öğrenci sizin aktif öğrenci listenizde değil.',
      };
    }

    const duplicateMessage =
      'Bu materyalin sınavı bu öğrenciye zaten atanmış.';

    const { data: existingAssignment, error: duplicateError } = await client
      .from('assignments')
      .select('id')
      .eq('library_id', libraryId)
      .eq('student_id', studentId)
      .eq('assignment_type', 'exam')
      .maybeSingle();

    if (duplicateError) {
      console.error(
        '[library] Mükerrer sınav ataması kontrolü başarısız:',
        duplicateError.message,
      );
    } else if (existingAssignment) {
      return { success: false, error: duplicateMessage };
    }

    const { error: insertError } = await client.from('assignments').insert({
      library_id: libraryId,
      teacher_id: teacher.id,
      student_id: studentId,
      status: 'assigned',
      assignment_type: 'exam',
      exam_payload: validatedExam,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return { success: false, error: duplicateMessage };
      }
      console.error('[library] Sınav ataması kaydedilemedi:', insertError.message);
      return { success: false, error: 'Sınav öğrenciye atanamadı.' };
    }

    revalidatePath('/teacher/dashboard');
    revalidatePath('/student/dashboard');

    return { success: true };
  } catch (error) {
    console.error(
      '[library] assignGeneratedExamAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

// ---------------------------------------------------------------------------
// Ödev ilerleme (öğretmen görünümü)
// ---------------------------------------------------------------------------

export type AssignmentWorkflowStatus =
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | string;

export interface TeacherAssignmentExamResult {
  scaledResult: string;
  percentage: number;
}

export interface TeacherAssignmentProgressRow {
  assignmentId: string;
  studentId: string;
  studentFullName: string;
  materialTitle: string;
  curriculum: string;
  assignmentType: AssignmentType;
  status: AssignmentWorkflowStatus;
  assignedAt: string;
  /** Atama sınavı tamamlandıysa en güncel deneme sonucu. */
  examResult: TeacherAssignmentExamResult | null;
}

/**
 * Öğretmenin öğrencilerine atadığı ödevlerin anlık durum listesi.
 */
export async function getTeacherAssignmentsProgressAction(): Promise<
  LibraryActionResult<TeacherAssignmentProgressRow[]>
> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu veri için onaylı öğretmen hesabı gerekiyor.',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: rows, error: assignError } = await client
      .from('assignments')
      .select(
        `
        id,
        status,
        created_at,
        student_id,
        assignment_type,
        exam_payload,
        libraries (
          title,
          curriculum
        )
      `,
      )
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false });

    if (assignError) {
      console.error(
        '[library] Ödev ilerlemesi okunamadı:',
        assignError.message,
      );
      return { success: false, error: 'Ödev listesi okunamadı.' };
    }

    type ProgressRow = {
      id: string;
      status: string;
      created_at: string;
      student_id: string;
      assignment_type: string | null;
      exam_payload: unknown;
      libraries:
        | { title: string; curriculum: string }
        | { title: string; curriculum: string }[]
        | null;
    };

    const assignmentRows = (rows ?? []) as ProgressRow[];

    const studentIds = [
      ...new Set(
        assignmentRows
          .map((row) => row.student_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];

    const studentNameById = new Map<string, string>();

    if (studentIds.length > 0) {
      const { data: profiles, error: profileError } = await client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', studentIds);

      if (profileError) {
        console.error(
          '[library] Öğrenci profilleri okunamadı:',
          profileError.message,
        );
      } else {
        for (const profile of profiles ?? []) {
          const row = profile as {
            id: string;
            full_name: string | null;
            email: string;
          };
          studentNameById.set(
            row.id,
            row.full_name?.trim() || row.email || 'İsimsiz öğrenci',
          );
        }
      }
    }

    const assignmentIds = assignmentRows.map((row) => row.id);

    const latestAttemptByAssignment = new Map<
      string,
      TeacherAssignmentExamResult
    >();

    if (assignmentIds.length > 0) {
      const attemptsClient = getSupabaseAdmin('interscola');
      if (attemptsClient) {
        const { data: attemptRows, error: attemptsError } =
          await attemptsClient
            .from(ATTEMPTS_TABLE)
            .select('assignment_id, scaled_result, percentage, created_at')
            .in('assignment_id', assignmentIds)
            .order('created_at', { ascending: false });

        if (attemptsError) {
          console.error(
            '[library] Atama denemeleri okunamadı:',
            attemptsError.message,
          );
        } else {
          for (const attempt of attemptRows ?? []) {
            const item = attempt as {
              assignment_id: string | null;
              scaled_result: string | null;
              percentage: number | null;
            };
            if (
              !item.assignment_id ||
              latestAttemptByAssignment.has(item.assignment_id)
            ) {
              continue;
            }
            if (
              typeof item.scaled_result !== 'string' ||
              !item.scaled_result.trim()
            ) {
              continue;
            }
            const percentage =
              typeof item.percentage === 'number' &&
              Number.isFinite(item.percentage)
                ? item.percentage
                : 0;

            latestAttemptByAssignment.set(item.assignment_id, {
              scaledResult: item.scaled_result.trim(),
              percentage,
            });
          }
        }
      }
    }

    const data: TeacherAssignmentProgressRow[] = assignmentRows.map((row) => {
      const libraryRaw = row.libraries;
      const library = Array.isArray(libraryRaw) ? libraryRaw[0] : libraryRaw;

      const assignmentType: AssignmentType =
        row.assignment_type === 'exam' ||
        row.assignment_type === 'study'
          ? row.assignment_type
          : hasStoredExamPayload(row.exam_payload)
            ? 'exam'
            : 'study';

      return {
        assignmentId: row.id,
        studentId: row.student_id,
        studentFullName:
          studentNameById.get(row.student_id) ?? 'İsimsiz öğrenci',
        materialTitle: library?.title ?? 'Materyal',
        curriculum: library?.curriculum ?? '—',
        assignmentType,
        status: row.status,
        assignedAt: row.created_at,
        examResult:
          assignmentType === 'exam'
            ? (latestAttemptByAssignment.get(row.id) ?? null)
            : null,
      };
    });

    return { success: true, data };
  } catch (error) {
    console.error(
      '[library] getTeacherAssignmentsProgressAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Ödev ilerlemesi yüklenemedi.' };
  }
}

// ---------------------------------------------------------------------------
// Client köprüleri
// ---------------------------------------------------------------------------

export async function createLibraryFormAction(input: {
  title: string;
  curriculum: string;
  subject?: string;
  extracted_text?: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await createLibraryItemAction(input);
  return { success: result.success, error: result.error };
}

export async function assignMaterialFormAction(
  libraryId: string,
  studentId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await assignStudyMaterialAction(libraryId, studentId);
  return { success: result.success, error: result.error };
}

export async function assignStudyMaterialFormAction(
  libraryId: string,
  studentId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await assignStudyMaterialAction(libraryId, studentId);
  return { success: result.success, error: result.error };
}

export async function generateExamFromLibraryFormAction(
  libraryId: string,
  questionCount: number,
): Promise<{
  success: boolean;
  error?: string;
  exam?: AssessmentPayload;
}> {
  const result = await generateExamFromLibraryAction(libraryId, questionCount);
  return {
    success: result.success,
    error: result.error,
    exam: result.data,
  };
}

export async function assignGeneratedExamFormAction(
  libraryId: string,
  studentId: string,
  examPayload: AssessmentPayload,
): Promise<{ success: boolean; error?: string }> {
  const result = await assignGeneratedExamAction(
    libraryId,
    studentId,
    examPayload,
  );
  return { success: result.success, error: result.error };
}
