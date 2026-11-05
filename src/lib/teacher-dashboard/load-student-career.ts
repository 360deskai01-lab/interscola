import type { SupabaseClient } from '@supabase/supabase-js';

import { getCareerAssessmentReadClient } from '@/lib/career-assessment/read-client';
import {
  loadStudentCareerInsightForTeacher,
  type StudentCareerInsightForTeacher,
} from '@/lib/student-dashboard/teacher-career-insight';
import { loadStudentCareerSnapshot } from '@/lib/student-dashboard/load-career-assessment';
import type { StudentCareerSnapshot } from '@/lib/student-command-center/types';

/**
 * Öğretmen paneli: bağlı öğrencinin kümülatif kariyer pusulası özeti.
 * Service role ile okur (RLS bypass).
 */
export async function loadTeacherStudentCareerSnapshot(
  studentId: string,
  studentName?: string,
  clientOverride?: SupabaseClient,
): Promise<StudentCareerSnapshot> {
  const client =
    clientOverride ?? (await getCareerAssessmentReadClient());
  if (!client) {
    return {
      hasAssessment: false,
      topTraits: [],
      radarData: [],
      primaryMajors: [],
      secondaryMajors: [],
      suggestedMajors: [],
      pinnedUniversityNames: [],
    };
  }

  return loadStudentCareerSnapshot(client, studentId.trim());
}

export async function loadTeacherStudentCareerInsight(
  studentId: string,
  studentName?: string,
  clientOverride?: SupabaseClient,
): Promise<StudentCareerInsightForTeacher> {
  const client =
    clientOverride ?? (await getCareerAssessmentReadClient());
  if (!client) {
    return {
      hasAssessment: false,
      studentName,
      topTraits: [],
      viaCognitiveStrengths: [],
      cognitiveHighlights: [],
      radarData: [],
      primaryMajors: [],
      secondaryMajors: [],
      suggestedMajors: [],
      targetUniversities: [],
    };
  }

  return loadStudentCareerInsightForTeacher(
    client,
    studentId.trim(),
    studentName,
  );
}
