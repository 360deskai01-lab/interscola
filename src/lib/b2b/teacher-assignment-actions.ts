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
  data?: T;
};

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
        } else if (result.error) {
          lastError = result.error;
        }
      }
    }

    if (created === 0) {
      return {
        success: false,
        error:
          lastError ??
          'Hiçbir öğrenciye atama yapılamadı (mükerrer veya yetki hatası).',
      };
    }

    return { success: true, count: created };
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
