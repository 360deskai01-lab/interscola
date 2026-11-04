'use server';

import { startDiagnosticSelfPacedExamAction } from '@/app/student/public-library-actions';
import type { CurriculumCode } from '@/types/exam';

export async function startTestEtDiagnosticAction(
  curriculum: CurriculumCode,
): Promise<{
  success: boolean;
  error?: string;
  assignmentId?: string;
  needsAuth?: boolean;
}> {
  const result = await startDiagnosticSelfPacedExamAction(curriculum);
  if (result.success) {
    return result;
  }

  const message = result.error ?? '';
  const needsAuth =
    message.includes('öğrenci hesabı') ||
    message.includes('onaylı') ||
    message.includes('oturum');

  return { ...result, needsAuth };
}
