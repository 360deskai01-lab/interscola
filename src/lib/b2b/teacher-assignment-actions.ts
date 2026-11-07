'use server';

import {
  assessmentPayloadFromJsonb,
  hasStoredExamPayload,
} from '@/lib/assessment-payload';
import { getCurrentProfile, type ProfileRecord } from '@/lib/auth';
import { resolveExamPayloadForLibrary } from '@/lib/library-exam-generation';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
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
