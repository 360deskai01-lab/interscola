import {
  ModelOutputError,
  ProviderError,
  QuestionCountMismatchError,
  runGenerateExam,
  type GenerateExamRequest,
} from '@/app/api/generate-exam/route';
import {
  assessmentPayloadFromJsonb,
  hasStoredExamPayload,
} from '@/lib/assessment-payload';
import type {
  AssessmentPayload,
  CurriculumCode,
  EngineType,
} from '@/types/exam';

export const LIBRARY_EXAM_MODE: Record<
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

export const MIN_LIBRARY_EXTRACTED_TEXT_CHARS = 40;

export type PublicLibraryExamSource = {
  title: string;
  curriculum: string;
  subject: string | null;
  extracted_text: string | null;
  exam_payload: unknown;
};

export function mapGenerateExamFailure(error: unknown): string {
  if (error instanceof ProviderError) {
    return error.message;
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
 * Kütüphane kaydından sınav payload'ı: hazır JSONB varsa onu, yoksa metinden üretir.
 */
export async function resolveExamPayloadForLibrary(
  row: PublicLibraryExamSource,
  questionCount: number,
): Promise<{ ok: true; exam: AssessmentPayload } | { ok: false; error: string }> {
  if (hasStoredExamPayload(row.exam_payload)) {
    const exam = assessmentPayloadFromJsonb(row.exam_payload);
    if (exam) {
      return { ok: true, exam };
    }
  }

  const curriculum = row.curriculum.trim().toUpperCase();
  if (!['SAT', 'IELTS', 'CAIE'].includes(curriculum)) {
    return { ok: false, error: 'Materyalin hedef sınavı desteklenmiyor.' };
  }

  const extracted = row.extracted_text?.trim() ?? '';
  if (extracted.length < MIN_LIBRARY_EXTRACTED_TEXT_CHARS) {
    return {
      ok: false,
      error:
        'Bu materyalden sınav üretmek için yeterli metin yok. Başka bir açık materyal deneyin.',
    };
  }

  const mode = LIBRARY_EXAM_MODE[curriculum as CurriculumCode];
  const subject =
    (row.subject?.trim() || mode.defaultSubject || row.title).trim() ||
    row.title;

  const clampedCount = Math.min(
    mode.maxQuestions,
    Math.max(1, Math.trunc(questionCount)),
  );

  const input: GenerateExamRequest = {
    curriculum: curriculum as CurriculumCode,
    engineType: mode.engineType,
    subject,
    questionCount: clampedCount,
    promptContext: extracted,
  };

  try {
    const exam = await runGenerateExam(input);
    if (!exam.questions?.length) {
      return { ok: false, error: 'Üretilen sınav geçersiz (soru yok).' };
    }
    return { ok: true, exam };
  } catch (error) {
    return { ok: false, error: mapGenerateExamFailure(error) };
  }
}

export function libraryHasExamCapability(row: PublicLibraryExamSource): boolean {
  if (hasStoredExamPayload(row.exam_payload)) {
    return true;
  }
  const text = row.extracted_text?.trim() ?? '';
  return text.length >= MIN_LIBRARY_EXTRACTED_TEXT_CHARS;
}
