'use server';

import { revalidatePath } from 'next/cache';
import {
  assessmentPayloadFromJsonb,
  hasStoredExamPayload,
} from '@/lib/assessment-payload';
import { getCurrentProfile } from '@/lib/auth';
import type { AssessmentPayload } from '@/types/exam';
import { evaluationFromAttempt, parseAttempt } from '@/lib/exam-shared';
import {
  loadStudentAnalyticsData,
  type StudentAnalyticsData,
} from '@/lib/student-analytics';

export type {
  StudentAnalyticsData,
  StudentAnalyticsDelta,
  StudentAttemptAnalyticsPoint,
  StudentLearningGap,
} from '@/lib/student-analytics';
import { ATTEMPTS_TABLE, getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import type { EvaluationResult } from '@/types/exam';
import { getSupabaseServer } from '@/lib/supabase/server';

/** Davet kabul action'ının dönüş biçimi. */
export interface ClaimResult {
  success: boolean;
  error?: string;
  /** Bağlantı kurulan öğretmenin adı (başarı durumunda). */
  teacherName?: string;
}

type InviteRow = {
  id: string;
  teacher_id: string;
  student_id: string | null;
  invite_code: string;
  status: string;
};

/**
 * Varsa service role, yoksa çerezli SSR istemcisi.
 * `student_teachers` ve `profiles` tabloları `public` şemasındadır.
 */
async function getProfilesClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

/** Onaylı öğrenci oturumu; aksi halde `null`. */
async function requireApprovedStudent(): Promise<{
  userId: string;
} | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'student') return null;
  if (current.profile.status !== 'approved') return null;
  return { userId: current.user.id };
}

// ---------------------------------------------------------------------------
// Bağlı öğretmenleri okuma
// ---------------------------------------------------------------------------

/** Öğrencinin bağlı olduğu öğretmen. */
export interface LinkedTeacher {
  linkId: string;
  teacherId: string;
  fullName: string;
  email: string;
  linkedAt: string;
}

/**
 * Öğrencinin `status = 'active'` bağlı öğretmenlerini döner.
 * `student_teachers` ve `profiles` `public` şemasındadır.
 */
export async function getStudentTeachersAction(): Promise<{
  success: boolean;
  error?: string;
  teachers?: LinkedTeacher[];
}> {
  try {
    const current = await getCurrentProfile();
    if (!current) {
      return { success: false, error: 'Bu işlem için giriş yapmalısın.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: links, error: linkError } = await client
      .from('student_teachers')
      .select('id, teacher_id, status, created_at')
      .eq('student_id', current.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (linkError) {
      console.error('[student] Bağlı öğretmenler okunamadı:', linkError.message);
      return { success: false, error: 'Eğitmen listesi okunamadı.' };
    }

    const rows = (links ?? []) as {
      id: string;
      teacher_id: string;
      status: string;
      created_at: string;
    }[];

    if (rows.length === 0) {
      return { success: true, teachers: [] };
    }

    const teacherIds = rows
      .map((row) => row.teacher_id)
      .filter((id): id is string => typeof id === 'string');

    const { data: profiles, error: profileError } = await client
      .from('profiles')
      .select('id, full_name, email')
      .in('id', teacherIds);

    if (profileError) {
      console.error(
        '[student] Öğretmen profilleri okunamadı:',
        profileError.message,
      );
    }

    const profileById = new Map<
      string,
      { full_name: string | null; email: string }
    >();

    for (const profile of profiles ?? []) {
      const row = profile as {
        id: string;
        full_name: string | null;
        email: string;
      };
      profileById.set(row.id, {
        full_name: row.full_name,
        email: row.email,
      });
    }

    const teachers: LinkedTeacher[] = rows.map((row) => {
      const profile = profileById.get(row.teacher_id);
      return {
        linkId: row.id,
        teacherId: row.teacher_id,
        fullName: profile?.full_name ?? 'İsimsiz eğitmen',
        email: profile?.email ?? '—',
        linkedAt: row.created_at,
      };
    });

    return { success: true, teachers };
  } catch (error) {
    console.error(
      '[student] getStudentTeachersAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Eğitmen listesi yüklenemedi.' };
  }
}

export type StudentAssignmentType = 'study' | 'exam';

export interface StudentAssignmentExamResult {
  scaledResult: string;
  percentage: number;
}

/** Öğretmenden gelen atanmış materyal / ödev kaydı. */
export interface StudentAssignment {
  id: string;
  materialTitle: string;
  curriculum: string;
  teacherId: string;
  teacherName: string;
  status: string;
  assignedAt: string;
  assignmentType: StudentAssignmentType;
  /** Çalışma ataması için okuma metni (study). */
  studyMaterialText: string | null;
  /** Tamamlanan sınav sonucu (exam). */
  examResult: StudentAssignmentExamResult | null;
}

function normalizeAssignmentType(
  assignmentType: unknown,
  examPayload: unknown,
): StudentAssignmentType {
  if (assignmentType === 'exam' || assignmentType === 'study') {
    return assignmentType;
  }
  return hasStoredExamPayload(examPayload) ? 'exam' : 'study';
}

/**
 * Oturum açmış öğrenciye atanmış materyalleri listeler.
 * `assignments` ve `libraries` tabloları `public` şemasındadır.
 */
export async function getStudentAssignmentsAction(): Promise<{
  success: boolean;
  error?: string;
  assignments?: StudentAssignment[];
}> {
  try {
    const current = await getCurrentProfile();
    if (!current) {
      return { success: false, error: 'Bu işlem için giriş yapmalısın.' };
    }

    if (
      current.profile.role !== 'student' ||
      current.profile.status !== 'approved'
    ) {
      return { success: false, error: 'Bu veri yalnızca onaylı öğrenciler içindir.' };
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
        teacher_id,
        assignment_type,
        exam_payload,
        libraries (
          title,
          curriculum,
          extracted_text
        )
      `,
      )
      .eq('student_id', current.user.id)
      .not('teacher_id', 'is', null)
      .order('created_at', { ascending: false });

    if (assignError) {
      console.error(
        '[student] Atamalar okunamadı:',
        assignError.message,
      );
      return { success: false, error: 'Ödev listesi okunamadı.' };
    }

    type AssignmentRow = {
      id: string;
      status: string;
      created_at: string;
      teacher_id: string;
      assignment_type: string | null;
      exam_payload: unknown;
      libraries:
        | { title: string; curriculum: string; extracted_text: string | null }
        | { title: string; curriculum: string; extracted_text: string | null }[]
        | null;
    };

    const assignmentRows = (rows ?? []) as AssignmentRow[];

    const examAssignmentIds = assignmentRows
      .filter(
        (row) =>
          normalizeAssignmentType(row.assignment_type, row.exam_payload) ===
          'exam',
      )
      .map((row) => row.id);

    const examResultByAssignment = new Map<string, StudentAssignmentExamResult>();

    if (examAssignmentIds.length > 0) {
      const attemptsClient = getSupabaseAdmin('interscola');
      if (attemptsClient) {
        const { data: attemptRows, error: attemptsError } = await attemptsClient
          .from(ATTEMPTS_TABLE)
          .select('assignment_id, scaled_result, percentage, created_at')
          .in('assignment_id', examAssignmentIds)
          .order('created_at', { ascending: false });

        if (attemptsError) {
          console.error(
            '[student] Sınav sonuçları okunamadı:',
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
              examResultByAssignment.has(item.assignment_id)
            ) {
              continue;
            }
            if (
              typeof item.scaled_result !== 'string' ||
              !item.scaled_result.trim()
            ) {
              continue;
            }
            examResultByAssignment.set(item.assignment_id, {
              scaledResult: item.scaled_result.trim(),
              percentage:
                typeof item.percentage === 'number' &&
                Number.isFinite(item.percentage)
                  ? item.percentage
                  : 0,
            });
          }
        }
      }
    }

    const teacherIds = [
      ...new Set(
        assignmentRows
          .map((row) => row.teacher_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];

    const teacherNameById = new Map<string, string>();

    if (teacherIds.length > 0) {
      const { data: profiles, error: profileError } = await client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', teacherIds);

      if (profileError) {
        console.error(
          '[student] Eğitmen profilleri okunamadı:',
          profileError.message,
        );
      } else {
        for (const profile of profiles ?? []) {
          const row = profile as {
            id: string;
            full_name: string | null;
            email: string;
          };
          teacherNameById.set(
            row.id,
            row.full_name?.trim() || row.email || 'Eğitmen',
          );
        }
      }
    }

    const assignments: StudentAssignment[] = assignmentRows.map((row) => {
      const libraryRaw = row.libraries;
      const library = Array.isArray(libraryRaw)
        ? libraryRaw[0]
        : libraryRaw;

      const assignmentType = normalizeAssignmentType(
        row.assignment_type,
        row.exam_payload,
      );

      return {
        id: row.id,
        materialTitle: library?.title ?? 'Materyal',
        curriculum: library?.curriculum ?? '—',
        teacherId: row.teacher_id,
        teacherName:
          teacherNameById.get(row.teacher_id) ?? 'Eğitmen',
        status: row.status,
        assignedAt: row.created_at,
        assignmentType,
        studyMaterialText:
          assignmentType === 'study'
            ? library?.extracted_text?.trim() || null
            : null,
        examResult:
          assignmentType === 'exam'
            ? (examResultByAssignment.get(row.id) ?? null)
            : null,
      };
    });

    return { success: true, assignments };
  } catch (error) {
    console.error(
      '[student] getStudentAssignmentsAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Ödev listesi yüklenemedi.' };
  }
}

export type AssignmentProgressStatus = 'in_progress' | 'completed';

const ASSIGNMENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StudentAssignmentExamContext {
  assignmentId: string;
  libraryId: string | null;
  materialTitle: string;
  status: string;
  exam: AssessmentPayload;
  isSelfPractice: boolean;
}

/**
 * Öğrencinin atanan sınavını çözüm ekranı için yükler.
 */
export async function getStudentAssignmentExamAction(
  assignmentId: string,
): Promise<{
  success: boolean;
  error?: string;
  context?: StudentAssignmentExamContext;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    if (!ASSIGNMENT_UUID_PATTERN.test(assignmentId)) {
      return { success: false, error: 'Geçersiz ödev kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: row, error: readError } = await client
      .from('assignments')
      .select(
        `
        id,
        status,
        student_id,
        teacher_id,
        library_id,
        assignment_type,
        exam_payload,
        libraries ( title )
      `,
      )
      .eq('id', assignmentId)
      .maybeSingle();

    if (readError) {
      console.error('[student] Atama okunamadı:', readError.message);
      return { success: false, error: 'Ödev bulunamadı.' };
    }

    if (!row) {
      return { success: false, error: 'Ödev bulunamadı.' };
    }

    type Row = {
      id: string;
      status: string;
      student_id: string;
      teacher_id: string | null;
      library_id: string | null;
      assignment_type: string | null;
      exam_payload: unknown;
      libraries: { title: string } | { title: string }[] | null;
    };

    const assignment = row as Row;

    if (assignment.student_id !== student.userId) {
      return { success: false, error: 'Bu ödev sana ait değil.' };
    }

    const assignmentType = normalizeAssignmentType(
      assignment.assignment_type,
      assignment.exam_payload,
    );
    if (assignmentType !== 'exam') {
      return { success: false, error: 'Bu kayıt bir sınav ataması değil.' };
    }

    const exam = assessmentPayloadFromJsonb(assignment.exam_payload);
    if (!exam) {
      return { success: false, error: 'Bu ödevde atanmış bir sınav yok.' };
    }

    if (assignment.status === 'completed') {
      return {
        success: false,
        error: 'Bu sınavı zaten tamamladın.',
      };
    }

    const libraryRaw = assignment.libraries;
    const library = Array.isArray(libraryRaw) ? libraryRaw[0] : libraryRaw;
    const isSelfPractice = assignment.teacher_id === null;

    return {
      success: true,
      context: {
        assignmentId: assignment.id,
        libraryId: assignment.library_id,
        materialTitle: library?.title ?? exam.title,
        status: assignment.status,
        exam,
        isSelfPractice,
      },
    };
  } catch (error) {
    console.error(
      '[student] getStudentAssignmentExamAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Sınav yüklenemedi.' };
  }
}

export interface StudentAssignmentReviewContext {
  assignmentId: string;
  libraryId: string | null;
  materialTitle: string;
  exam: import('@/types/exam').AssessmentPayload;
  evaluation: EvaluationResult;
  studentAnswers: Record<string, string>;
  isSelfPractice: boolean;
}

/**
 * Tamamlanan atama sınavının karne / soru analizi verisi.
 */
export async function getStudentAssignmentReviewAction(
  assignmentId: string,
): Promise<{
  success: boolean;
  error?: string;
  context?: StudentAssignmentReviewContext;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    if (!ASSIGNMENT_UUID_PATTERN.test(assignmentId)) {
      return { success: false, error: 'Geçersiz ödev kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: row, error: readError } = await client
      .from('assignments')
      .select(
        `
        id,
        status,
        student_id,
        teacher_id,
        library_id,
        assignment_type,
        exam_payload,
        libraries ( title )
      `,
      )
      .eq('id', assignmentId)
      .maybeSingle();

    if (readError || !row) {
      return { success: false, error: 'Ödev bulunamadı.' };
    }

    const assignment = row as {
      id: string;
      status: string;
      student_id: string;
      teacher_id: string | null;
      library_id: string | null;
      assignment_type: string | null;
      exam_payload: unknown;
      libraries: { title: string } | { title: string }[] | null;
    };

    if (assignment.student_id !== student.userId) {
      return { success: false, error: 'Bu ödev sana ait değil.' };
    }

    if (
      normalizeAssignmentType(
        assignment.assignment_type,
        assignment.exam_payload,
      ) !== 'exam'
    ) {
      return { success: false, error: 'Bu kayıt bir sınav ataması değil.' };
    }

    const exam = assessmentPayloadFromJsonb(assignment.exam_payload);
    if (!exam) {
      return { success: false, error: 'Sınav verisi bulunamadı.' };
    }

    const attemptsClient = getSupabaseAdmin('interscola');
    if (!attemptsClient) {
      return { success: false, error: 'Deneme kaydı okunamadı.' };
    }

    const { data: attemptRow, error: attemptError } = await attemptsClient
      .from(ATTEMPTS_TABLE)
      .select(
        'id, curriculum, subject, exam_title, engine_type, raw_score, max_score, percentage, scaled_result, metric_breakdown, student_answers, evaluations, created_at',
      )
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attemptError || !attemptRow) {
      return {
        success: false,
        error: 'Henüz kaydedilmiş bir sınav sonucu yok.',
      };
    }

    const attempt = parseAttempt(attemptRow);
    if (!attempt) {
      return { success: false, error: 'Deneme kaydı okunamadı.' };
    }

    const libraryRaw = assignment.libraries;
    const library = Array.isArray(libraryRaw) ? libraryRaw[0] : libraryRaw;

    return {
      success: true,
      context: {
        assignmentId: assignment.id,
        libraryId: assignment.library_id,
        materialTitle: library?.title ?? exam.title,
        exam,
        evaluation: evaluationFromAttempt(attempt),
        studentAnswers: attempt.studentAnswers,
        isSelfPractice: assignment.teacher_id === null,
      },
    };
  } catch (error) {
    console.error(
      '[student] getStudentAssignmentReviewAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Karne yüklenemedi.' };
  }
}

/**
 * Atanan sınav tamamlandığında ödev durumunu `completed` yapar.
 */
export async function completeAssignmentExamAction(
  assignmentId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    if (!ASSIGNMENT_UUID_PATTERN.test(assignmentId)) {
      return { success: false, error: 'Geçersiz ödev kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: row, error: readError } = await client
      .from('assignments')
      .select('id, status, student_id, exam_payload')
      .eq('id', assignmentId)
      .maybeSingle();

    if (readError || !row) {
      return { success: false, error: 'Ödev bulunamadı.' };
    }

    const assignment = row as {
      id: string;
      status: string;
      student_id: string;
      exam_payload: unknown;
    };

    if (assignment.student_id !== student.userId) {
      return { success: false, error: 'Bu ödev sana ait değil.' };
    }

    if (!assessmentPayloadFromJsonb(assignment.exam_payload)) {
      return { success: false, error: 'Bu kayıt bir sınav ataması değil.' };
    }

    if (assignment.status === 'completed') {
      return { success: true };
    }

    if (
      assignment.status !== 'assigned' &&
      assignment.status !== 'in_progress'
    ) {
      return { success: false, error: 'Bu ödev tamamlanamaz durumda.' };
    }

    const { error: updateError } = await client
      .from('assignments')
      .update({ status: 'completed' })
      .eq('id', assignmentId)
      .eq('student_id', student.userId);

    if (updateError) {
      console.error(
        '[student] Sınav sonrası ödev güncellenemedi:',
        updateError.message,
      );
      return { success: false, error: 'Ödev durumu güncellenemedi.' };
    }

    revalidatePath('/student/dashboard');
    revalidatePath('/teacher/dashboard');
    revalidatePath(`/student/assignment/${assignmentId}`);

    return { success: true };
  } catch (error) {
    console.error(
      '[student] completeAssignmentExamAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function completeAssignmentExamFormAction(
  assignmentId: string,
): Promise<{ success: boolean; error?: string }> {
  return completeAssignmentExamAction(assignmentId);
}

/**
 * Öğrencinin kendine atanmış bir materyalin durumunu günceller.
 * Yalnızca kaydın sahibi (`student_id`) işlem yapabilir.
 */
export async function updateAssignmentStatusAction(
  assignmentId: string,
  status: AssignmentProgressStatus,
): Promise<{ success: boolean; error?: string }> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    if (typeof assignmentId !== 'string' || assignmentId.trim().length === 0) {
      return { success: false, error: 'Geçersiz ödev kimliği.' };
    }

    if (status !== 'in_progress' && status !== 'completed') {
      return { success: false, error: 'Geçersiz durum.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: row, error: readError } = await client
      .from('assignments')
      .select('id, status, student_id')
      .eq('id', assignmentId)
      .maybeSingle();

    if (readError) {
      console.error('[student] Ödev okunamadı:', readError.message);
      return { success: false, error: 'Ödev bulunamadı.' };
    }

    if (!row) {
      return { success: false, error: 'Ödev bulunamadı.' };
    }

    const assignment = row as {
      id: string;
      status: string;
      student_id: string;
    };

    if (assignment.student_id !== student.userId) {
      console.warn(
        '[student] Yetkisiz ödev durumu güncelleme:',
        student.userId,
        '->',
        assignmentId,
      );
      return { success: false, error: 'Bu ödev sana ait değil.' };
    }

    const currentStatus = assignment.status;

    if (status === 'in_progress' && currentStatus !== 'assigned') {
      return {
        success: false,
        error: 'Bu ödev zaten başlatılmış veya tamamlanmış.',
      };
    }

    if (status === 'completed' && currentStatus !== 'in_progress') {
      return {
        success: false,
        error: 'Önce ödevi başlatmalısın.',
      };
    }

    const { error: updateError } = await client
      .from('assignments')
      .update({ status })
      .eq('id', assignmentId)
      .eq('student_id', student.userId);

    if (updateError) {
      console.error(
        '[student] Ödev durumu güncellenemedi:',
        updateError.message,
      );
      return { success: false, error: 'Durum güncellenemedi.' };
    }

    revalidatePath('/student/dashboard');
    revalidatePath('/teacher/dashboard');

    return { success: true };
  } catch (error) {
    console.error(
      '[student] updateAssignmentStatusAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/**
 * Öğrenci panelindeki durum butonları için action köprüsü.
 */
export async function updateAssignmentStatusFormAction(
  assignmentId: string,
  status: AssignmentProgressStatus,
): Promise<{ success: boolean; error?: string }> {
  return updateAssignmentStatusAction(assignmentId, status);
}

/**
 * Öğrencinin girdiği davet kodunu kabul eder.
 *
 * Güvenlik ve tutarlılık kuralları:
 * - Yalnızca giriş yapmış öğrenci kullanabilir.
 * - Kod `pending` durumunda ve sahipsiz olmalı; kullanılmış kod reddedilir.
 * - Öğrenci zaten bir öğretmene bağlıysa ikinci bağlantı kurulmaz.
 * - Kod normalize edilir: boşluklar atılır, büyük harfe çevrilir.
 */
export async function claimTeacherInviteAction(
  inviteCode: string,
): Promise<ClaimResult> {
  try {
    const current = await getCurrentProfile();
    if (!current) {
      return { success: false, error: 'Bu işlem için giriş yapmalısın.' };
    }

    if (current.profile.role !== 'student') {
      return {
        success: false,
        error: 'Bu işlem yalnızca öğrenci hesapları için geçerli.',
      };
    }

    const normalized = inviteCode.trim().toUpperCase();
    if (normalized.length === 0) {
      return { success: false, error: 'Davet kodu boş olamaz.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: invite, error: inviteError } = await client
      .from('student_teachers')
      .select('id, teacher_id, student_id, invite_code, status')
      .eq('invite_code', normalized)
      .maybeSingle();

    if (inviteError) {
      console.error('[student] Davet kodu sorgusu başarısız:', inviteError.message);
      return { success: false, error: 'Davet kodu kontrol edilemedi.' };
    }

    if (!invite) {
      return { success: false, error: 'Geçersiz davet kodu.' };
    }

    const row = invite as InviteRow;

    if (row.status !== 'pending' || row.student_id !== null) {
      return {
        success: false,
        error: 'Bu davet kodu daha önce kullanılmış.',
      };
    }

    // Öğrencinin hâlihazırda aktif bir öğretmen bağlantısı var mı?
    const { data: existingLink, error: existingError } = await client
      .from('student_teachers')
      .select('id')
      .eq('student_id', current.user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingError) {
      console.error(
        '[student] Mevcut bağlantı kontrolü başarısız:',
        existingError.message,
      );
      return { success: false, error: 'Bağlantı durumu kontrol edilemedi.' };
    }

    if (existingLink) {
      return {
        success: false,
        error: 'Zaten bağlı bir öğretmenin var. Önce mevcut bağlantıyı kaldır.',
      };
    }

    /*
     * Güncelleme koşullu yapılır (`status = 'pending'` ve `student_id IS NULL`):
     * aynı kodu iki öğrenci aynı anda girerse yalnızca biri başarılı olur.
     * Bu, yarış durumuna karşı koruma sağlar.
     */
    const { data: updated, error: updateError } = await client
      .from('student_teachers')
      .update({
        student_id: current.user.id,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending')
      .is('student_id', null)
      .select('id')
      .maybeSingle();

    if (updateError) {
      console.error('[student] Davet kabul edilemedi:', updateError.message);
      return { success: false, error: 'Davet kabul edilemedi.' };
    }

    if (!updated) {
      return {
        success: false,
        error: 'Bu davet kodu az önce kullanıldı. Lütfen yeni bir kod iste.',
      };
    }

    // Öğretmenin adını göstermek için profil bilgisi okunur.
    let teacherName: string | undefined;
    try {
      const { data: teacherProfile } = await client
        .from('profiles')
        .select('full_name, email')
        .eq('id', row.teacher_id)
        .maybeSingle();

      if (teacherProfile) {
        const profile = teacherProfile as {
          full_name: string | null;
          email: string;
        };
        teacherName = profile.full_name ?? profile.email;
      }
    } catch {
      // İsim okunamazsa akış bozulmasın.
    }

    revalidatePath('/student/dashboard');
    revalidatePath('/');

    return { success: true, teacherName };
  } catch (error) {
    console.error(
      '[student] claimTeacherInviteAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

// ---------------------------------------------------------------------------
// Gelişim analitiği (FAZ 4.1 / 4.2)
// ---------------------------------------------------------------------------

/**
 * Öğrencinin tüm çözülmüş denemelerinden gelişim trendi ve öğrenme boşlukları.
 */
export async function getStudentAnalyticsAction(): Promise<{
  success: boolean;
  error?: string;
  data?: StudentAnalyticsData;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu veri için onaylı bir öğrenci hesabı gerekiyor.',
      };
    }

    const loaded = await loadStudentAnalyticsData(student.userId);
    if (!loaded.ok) {
      return { success: false, error: loaded.error };
    }

    return { success: true, data: loaded.data };
  } catch (error) {
    console.error(
      '[student] getStudentAnalyticsAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Gelişim analitiği yüklenemedi.' };
  }
}

// ---------------------------------------------------------------------------
// Panel form köprüsü
// ---------------------------------------------------------------------------

/**
 * Öğrenci panelindeki "Bağlan" formu için action köprüsü.
 * `claimTeacherInviteAction` ile aynı sonucu döner; client bileşene doğrudan
 * devredilebilmesi için ayrı bir isimle dışa açılır.
 */
export async function claimInviteFormAction(
  inviteCode: string,
): Promise<ClaimResult> {
  return claimTeacherInviteAction(inviteCode);
}
