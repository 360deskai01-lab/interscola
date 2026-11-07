'use server';

import {
  assessmentPayloadFromJsonb,
  hasStoredExamPayload,
} from '@/lib/assessment-payload';
import { getCurrentProfile, type ProfileRecord } from '@/lib/auth';
import type { TeacherAssignmentReviewDetail } from '@/lib/b2b/teacher-assignment-review-types';
import { isRecord } from '@/lib/exam-shared';
import { resolveExamPayloadForLibrary } from '@/lib/library-exam-generation';
import {
  ATTEMPTS_TABLE,
  getSupabaseAdmin,
  PROFILES_SCHEMA,
} from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { AssessmentPayload } from '@/types/exam';
import { getTeacherStudentsAction } from '@/app/teacher/actions';
import {
  assignGeneratedExamAction,
  assignStudyMaterialAction,
  getTeacherAssignmentsProgressAction,
  type LibraryActionResult,
  type TeacherAssignmentProgressRow,
} from '@/app/teacher/library-actions';

export type TeacherBulkAssignmentKind = 'homework' | 'official_mock';

export interface CreateTeacherAssignmentInput {
  /** Kütüphane (`libraries.id`) kimliği — API adı `examId`. */
  examId: string;
  targetStudentIds: string[];
  dueDate?: string | null;
  title: string;
  kind: TeacherBulkAssignmentKind;
}

export type TeacherAssignmentActionResult<T = undefined> = {
  success: boolean;
  error?: string;
  count?: number;
  skippedCount?: number;
  message?: string;
  data?: T;
};

export interface TeacherAssignmentStudentOption {
  studentId: string;
  fullName: string;
  email: string;
  scopeLabel: string;
  source: 'individual' | 'organization';
}

export {
  getTeacherAssignmentsProgressAction,
  type TeacherAssignmentProgressRow,
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const TEACHER_ORG_POOL_ROLES = new Set(['teacher', 'coordinator']);

function isAssignmentSkippedError(error: string | undefined): boolean {
  if (!error) return false;
  const haystack = error.toLocaleLowerCase('tr-TR');
  return (
    haystack.includes('zaten atan') ||
    haystack.includes('already') ||
    haystack.includes('mükerrer')
  );
}

/**
 * Bireysel `student_teachers` + aynı kurum şubesindeki öğrenciler (tekil).
 */
export async function getTeacherAssignmentStudentPoolAction(): Promise<
  TeacherAssignmentActionResult<TeacherAssignmentStudentOption[]>
> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Öğrenci listesi için onaylı öğretmen oturumu gerekiyor.',
      };
    }

    const studentsResult = await getTeacherStudentsAction();
    const byId = new Map<string, TeacherAssignmentStudentOption>();

    if (studentsResult.success && studentsResult.data?.students) {
      for (const student of studentsResult.data.students) {
        byId.set(student.studentId, {
          studentId: student.studentId,
          fullName: student.fullName,
          email: student.email,
          scopeLabel: 'Bireysel öğrenci',
          source: 'individual',
        });
      }
    }

    const client = await getProfilesClient();
    if (!client) {
      return {
        success: true,
        data: [...byId.values()].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, 'tr'),
        ),
      };
    }

    const { data: teacherMember, error: memberError } = await client
      .from('organization_members')
      .select(
        `
        organization_id,
        branch_id,
        org_role,
        branches ( name )
      `,
      )
      .eq('user_id', teacher.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memberError?.code === '42P01') {
      return {
        success: true,
        data: [...byId.values()].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, 'tr'),
        ),
      };
    }

    if (!memberError && teacherMember) {
      const row = teacherMember as {
        organization_id: string;
        branch_id: string | null;
        org_role: string | null;
        branches: { name: string } | { name: string }[] | null;
      };

      if (row.org_role && TEACHER_ORG_POOL_ROLES.has(row.org_role)) {
        const branchRaw = row.branches;
        const branchName = Array.isArray(branchRaw)
          ? branchRaw[0]?.name
          : branchRaw?.name;
        const scopeFallback = branchName?.trim() || 'Kurum öğrencisi';

        let orgQuery = client
          .from('organization_members')
          .select('user_id, branch_id, branches ( name )')
          .eq('organization_id', row.organization_id)
          .eq('org_role', 'student')
          .eq('is_active', true);

        if (row.branch_id) {
          orgQuery = orgQuery.eq('branch_id', row.branch_id);
        }

        const { data: orgMembers, error: orgError } = await orgQuery;

        if (!orgError && orgMembers && orgMembers.length > 0) {
          const userIds = orgMembers
            .map((m) => (m as { user_id: string }).user_id)
            .filter((id): id is string => typeof id === 'string');

          const { data: profiles } = await client
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

          const profileById = new Map<
            string,
            { full_name: string | null; email: string }
          >();
          for (const profile of profiles ?? []) {
            const p = profile as {
              id: string;
              full_name: string | null;
              email: string;
            };
            profileById.set(p.id, p);
          }

          for (const member of orgMembers) {
            const m = member as {
              user_id: string;
              branches: { name: string } | { name: string }[] | null;
            };
            if (byId.has(m.user_id)) continue;

            const branch = Array.isArray(m.branches)
              ? m.branches[0]
              : m.branches;
            const label = branch?.name?.trim() || scopeFallback;
            const profile = profileById.get(m.user_id);

            byId.set(m.user_id, {
              studentId: m.user_id,
              fullName:
                profile?.full_name?.trim() ||
                profile?.email ||
                'İsimsiz öğrenci',
              email: profile?.email ?? '',
              scopeLabel: label,
              source: 'organization',
            });
          }
        }
      }
    }

    const data = [...byId.values()].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'tr'),
    );
    return { success: true, data };
  } catch (error) {
    console.error(
      '[teacher-assignment] getTeacherAssignmentStudentPoolAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Öğrenci havuzu yüklenemedi.' };
  }
}

/**
 * homework → `assignment_type: study`; official_mock → `exam` (+ `exam_payload`).
 * Öğrenci kokpiti `exam` / `study` sözleşmesi korunur.
 */
export async function createTeacherAssignmentAction(
  input: CreateTeacherAssignmentInput,
): Promise<TeacherAssignmentActionResult> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğretmen oturumu gerekiyor.',
      };
    }

    const libraryId = typeof input.examId === 'string' ? input.examId.trim() : '';
    if (!UUID_PATTERN.test(libraryId)) {
      return { success: false, error: 'Geçersiz kütüphane sınav kimliği.' };
    }

    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (title.length < 2) {
      return { success: false, error: 'Atama başlığı en az 2 karakter olmalı.' };
    }

    const kind =
      input.kind === 'official_mock' ? 'official_mock' : 'homework';

    const studentIds = [
      ...new Set(
        (input.targetStudentIds ?? []).filter(
          (id): id is string =>
            typeof id === 'string' && UUID_PATTERN.test(id.trim()),
        ),
      ),
    ];

    if (studentIds.length === 0) {
      return { success: false, error: 'En az bir öğrenci seçmelisiniz.' };
    }

    const dueDate = input.dueDate ?? null;
    let created = 0;
    let skipped = 0;
    let lastError: string | undefined;

    if (kind === 'homework') {
      for (const studentId of studentIds) {
        const result = await assignStudyMaterialAction(
          libraryId,
          studentId,
          dueDate,
        );
        if (result.success) {
          created += 1;
        } else if (isAssignmentSkippedError(result.error)) {
          skipped += 1;
        } else if (result.error) {
          lastError = result.error;
        }
      }
    } else {
      const client = await getProfilesClient();
      if (!client) {
        return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
      }

      const { data: library, error: libraryError } = await client
        .from('libraries')
        .select(
          'id, teacher_id, title, curriculum, subject, extracted_text, exam_payload',
        )
        .eq('id', libraryId)
        .maybeSingle();

      if (libraryError || !library) {
        return { success: false, error: 'Kütüphane sınavı bulunamadı.' };
      }

      if ((library as { teacher_id: string }).teacher_id !== teacher.id) {
        return { success: false, error: 'Bu materyal size ait değil.' };
      }

      const source = library as {
        title: string;
        curriculum: string;
        subject: string | null;
        extracted_text: string | null;
        exam_payload: unknown;
      };

      let exam: AssessmentPayload | null = null;
      if (hasStoredExamPayload(source.exam_payload)) {
        exam = assessmentPayloadFromJsonb(source.exam_payload);
      }
      if (!exam) {
        const resolved = await resolveExamPayloadForLibrary(source, 5);
        if (!resolved.ok) {
          return {
            success: false,
            error: resolved.error,
          };
        }
        exam = resolved.exam;
      }

      for (const studentId of studentIds) {
        const result = await assignGeneratedExamAction(
          libraryId,
          studentId,
          exam,
          dueDate,
        );
        if (result.success) {
          created += 1;
        } else if (isAssignmentSkippedError(result.error)) {
          skipped += 1;
        } else if (result.error) {
          lastError = result.error;
        }
      }
    }

    if (created === 0) {
      if (skipped > 0) {
        return {
          success: false,
          count: 0,
          skippedCount: skipped,
          error:
            'Seçilen öğrencilerin tamamında bu görev zaten aktif veya tamamlanmış.',
        };
      }
      return {
        success: false,
        error:
          lastError ??
          'Hiçbir öğrenciye atama yapılamadı (yetki veya doğrulama hatası).',
      };
    }

    const message =
      skipped > 0
        ? `${created} öğrenciye atandı; ${skipped} öğrenci zaten bu göreve sahip olduğu için atlandı.`
        : `${created} öğrenciye başarıyla atandı.`;

    return {
      success: true,
      count: created,
      skippedCount: skipped,
      message,
    };
  } catch (error) {
    console.error(
      '[teacher-assignment] createTeacherAssignmentAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Toplu atama sırasında beklenmeyen hata.' };
  }
}

/** İstemci modalından çağrı için JSON-serializable köprü. */
export async function createTeacherAssignmentFormAction(
  input: CreateTeacherAssignmentInput,
): Promise<TeacherAssignmentActionResult> {
  return createTeacherAssignmentAction(input);
}

export async function fetchTeacherAssignmentsProgressAction(): Promise<
  LibraryActionResult<TeacherAssignmentProgressRow[]>
> {
  return getTeacherAssignmentsProgressAction();
}

export type { TeacherAssignmentReviewDetail };

function isMissingSchemaError(error: { code?: string; message?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

function collectWeaknessTopics(evaluations: unknown): string[] {
  if (!isRecord(evaluations)) return [];
  const topics: string[] = [];
  const top = evaluations.remedialTopics;
  if (Array.isArray(top)) {
    for (const item of top) {
      if (typeof item === 'string' && item.trim()) topics.push(item.trim());
    }
  }
  const ledger = evaluations.weakness_ledger;
  if (Array.isArray(ledger)) {
    for (const item of ledger) {
      if (typeof item === 'string' && item.trim()) topics.push(item.trim());
      if (isRecord(item) && typeof item.topic === 'string' && item.topic.trim()) {
        topics.push(item.topic.trim());
      }
    }
  }
  return [...new Set(topics)];
}

function formatDurationLabel(
  attemptRow: {
    time_spent_seconds?: number | null;
    duration_minutes?: number | null;
  } | null,
  examPayload: unknown,
): string | null {
  const seconds =
    attemptRow &&
    typeof attemptRow.time_spent_seconds === 'number' &&
    Number.isFinite(attemptRow.time_spent_seconds) &&
    attemptRow.time_spent_seconds > 0
      ? attemptRow.time_spent_seconds
      : null;
  if (seconds !== null) {
    const mins = Math.max(1, Math.round(seconds / 60));
    return `${mins} dk oturum`;
  }
  if (
    attemptRow &&
    typeof attemptRow.duration_minutes === 'number' &&
    Number.isFinite(attemptRow.duration_minutes)
  ) {
    return `${attemptRow.duration_minutes} dk kayıtlı`;
  }
  if (isRecord(examPayload) && typeof examPayload.durationMinutes === 'number') {
    return `${examPayload.durationMinutes} dk (planlanan)`;
  }
  return null;
}

export async function getTeacherAssignmentReviewDetailAction(input: {
  assignmentId: string;
}): Promise<TeacherAssignmentActionResult<TeacherAssignmentReviewDetail>> {
  try {
    const teacher = await requireApprovedTeacher();
    if (!teacher) {
      return {
        success: false,
        error: 'Bu veri için onaylı öğretmen oturumu gerekiyor.',
      };
    }

    const assignmentId =
      typeof input.assignmentId === 'string' ? input.assignmentId.trim() : '';
    if (!UUID_PATTERN.test(assignmentId)) {
      return { success: false, error: 'Geçersiz görev kimliği.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: assignment, error: assignmentError } = await client
      .from('assignments')
      .select(
        `
        id,
        teacher_id,
        student_id,
        status,
        assignment_type,
        exam_payload,
        libraries (
          title,
          curriculum
        )
      `,
      )
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentError) {
      if (isMissingSchemaError(assignmentError)) {
        return { success: false, error: 'Görev kaydı okunamadı (şema).' };
      }
      console.error(
        '[teacher-assignment] review assignment:',
        assignmentError.message,
      );
      return { success: false, error: 'Görev bulunamadı.' };
    }

    if (!assignment) {
      return { success: false, error: 'Görev bulunamadı.' };
    }

    const row = assignment as {
      id: string;
      teacher_id: string;
      student_id: string;
      status: string;
      assignment_type: string | null;
      exam_payload: unknown;
      libraries:
        | { title: string; curriculum: string }
        | { title: string; curriculum: string }[]
        | null;
    };

    if (row.teacher_id !== teacher.id) {
      return { success: false, error: 'Bu görev size ait değil.' };
    }

    const library = Array.isArray(row.libraries)
      ? row.libraries[0]
      : row.libraries;

    const assignmentType: 'exam' | 'study' =
      row.assignment_type === 'exam' ||
      row.assignment_type === 'study'
        ? row.assignment_type
        : hasStoredExamPayload(row.exam_payload)
          ? 'exam'
          : 'study';

    const { data: profile } = await client
      .from('profiles')
      .select('full_name, email')
      .eq('id', row.student_id)
      .maybeSingle();

    const studentFullName =
      (profile as { full_name?: string | null; email?: string } | null)
        ?.full_name?.trim() ||
      (profile as { email?: string } | null)?.email ||
      'İsimsiz öğrenci';

    const isCompleted = row.status === 'completed';

    if (!isCompleted) {
      return {
        success: true,
        data: {
          assignmentId: row.id,
          materialTitle: library?.title ?? 'Materyal',
          studentFullName,
          curriculum: library?.curriculum ?? '—',
          assignmentType,
          status: row.status,
          isCompleted: false,
          scaledResult: null,
          rawScore: null,
          maxScore: null,
          percentage: null,
          completedAt: null,
          durationLabel: null,
          weaknessTopics: [],
        },
      };
    }

    if (assignmentType === 'study') {
      return {
        success: true,
        data: {
          assignmentId: row.id,
          materialTitle: library?.title ?? 'Materyal',
          studentFullName,
          curriculum: library?.curriculum ?? '—',
          assignmentType,
          status: row.status,
          isCompleted: true,
          scaledResult: 'Tamamlandı',
          rawScore: null,
          maxScore: null,
          percentage: null,
          completedAt: null,
          durationLabel: null,
          weaknessTopics: [],
        },
      };
    }

    const attemptsClient = getSupabaseAdmin('interscola');
    if (!attemptsClient) {
      return {
        success: true,
        data: {
          assignmentId: row.id,
          materialTitle: library?.title ?? 'Materyal',
          studentFullName,
          curriculum: library?.curriculum ?? '—',
          assignmentType,
          status: row.status,
          isCompleted: true,
          scaledResult: null,
          rawScore: null,
          maxScore: null,
          percentage: null,
          completedAt: null,
          durationLabel: formatDurationLabel(null, row.exam_payload),
          weaknessTopics: [],
        },
      };
    }

    const selectRich =
      'id, scaled_result, raw_score, max_score, percentage, created_at, evaluations, time_spent_seconds, duration_minutes, weakness_ledger';
    const selectLean =
      'id, scaled_result, raw_score, max_score, percentage, created_at, evaluations';

    let attempt: Record<string, unknown> | null = null;

    let attemptRows: unknown[] | null = null;
    let attemptError: { code?: string; message?: string } | null = null;

    const primaryAttempt = await attemptsClient
      .from(ATTEMPTS_TABLE)
      .select(selectRich)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
      .limit(1);

    attemptRows = primaryAttempt.data;
    attemptError = primaryAttempt.error;

    if (attemptError && isMissingSchemaError(attemptError)) {
      return {
        success: true,
        data: {
          assignmentId: row.id,
          materialTitle: library?.title ?? 'Materyal',
          studentFullName,
          curriculum: library?.curriculum ?? '—',
          assignmentType,
          status: row.status,
          isCompleted: true,
          scaledResult: null,
          rawScore: null,
          maxScore: null,
          percentage: null,
          completedAt: null,
          durationLabel: formatDurationLabel(null, row.exam_payload),
          weaknessTopics: [],
        },
      };
    }

    if (attemptError?.code === '42703') {
      const fallback = await attemptsClient
        .from(ATTEMPTS_TABLE)
        .select(selectLean)
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: false })
        .limit(1);
      attemptError = fallback.error;
      attemptRows = (fallback.data ?? []) as unknown[];
    }

    if (attemptError) {
      console.error(
        '[teacher-assignment] review attempt:',
        attemptError.message,
      );
    } else if (attemptRows && attemptRows.length > 0 && isRecord(attemptRows[0])) {
      attempt = attemptRows[0] as Record<string, unknown>;
    }

    const weaknessFromLedger = Array.isArray(attempt?.weakness_ledger)
      ? (attempt!.weakness_ledger as unknown[])
          .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (isRecord(item) && typeof item.topic === 'string') {
              return item.topic.trim();
            }
            return '';
          })
          .filter(Boolean)
      : [];

    const weaknessTopics = [
      ...new Set([
        ...collectWeaknessTopics(attempt?.evaluations),
        ...weaknessFromLedger,
      ]),
    ];

    const scaled =
      typeof attempt?.scaled_result === 'string'
        ? attempt.scaled_result.trim()
        : null;
    const rawScore =
      typeof attempt?.raw_score === 'number' && Number.isFinite(attempt.raw_score)
        ? attempt.raw_score
        : null;
    const maxScore =
      typeof attempt?.max_score === 'number' && Number.isFinite(attempt.max_score)
        ? attempt.max_score
        : null;
    const percentage =
      typeof attempt?.percentage === 'number' &&
      Number.isFinite(attempt.percentage)
        ? Math.round(attempt.percentage)
        : null;

    return {
      success: true,
      data: {
        assignmentId: row.id,
        materialTitle: library?.title ?? 'Materyal',
        studentFullName,
        curriculum: library?.curriculum ?? '—',
        assignmentType,
        status: row.status,
        isCompleted: true,
        scaledResult: scaled,
        rawScore,
        maxScore,
        percentage,
        completedAt:
          typeof attempt?.created_at === 'string' ? attempt.created_at : null,
        durationLabel: formatDurationLabel(
          attempt as {
            time_spent_seconds?: number | null;
            duration_minutes?: number | null;
          } | null,
          row.exam_payload,
        ),
        weaknessTopics,
      },
    };
  } catch (error) {
    console.error(
      '[teacher-assignment] getTeacherAssignmentReviewDetailAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Görev detayı yüklenemedi.' };
  }
}

export async function getTeacherAssignmentReviewDetailFormAction(input: {
  assignmentId: string;
}): Promise<TeacherAssignmentActionResult<TeacherAssignmentReviewDetail>> {
  return getTeacherAssignmentReviewDetailAction(input);
}
