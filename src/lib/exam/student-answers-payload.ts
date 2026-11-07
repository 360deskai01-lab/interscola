import type { AssessmentPayload } from '@/types/exam';

/**
 * Grade-exam API'sine giden yanıt haritası: her soru id'si için en azından boş string.
 */
export function buildStudentAnswersPayload(
  exam: AssessmentPayload,
  answers: Record<string, string>,
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const question of exam.questions) {
    const raw = answers[question.id];
    payload[question.id] = typeof raw === 'string' ? raw : '';
  }
  return payload;
}

export function hasSubstantiveAnswerInPayload(
  payload: Record<string, string>,
): boolean {
  return Object.values(payload).some((value) => value.trim().length > 0);
}
