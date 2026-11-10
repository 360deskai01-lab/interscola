import type {
  AssessmentPayload,
  CurriculumCode,
  EngineType,
  ExamQuestion,
} from '@/types/exam';
import {
  inferSessionFormat,
  minimumDurationMinutesForSession,
} from '@/lib/exam/exam-session-formats';
import { ensureValidCaieQuestionRubric } from '@/lib/exam/caie-rubric';

const CURRICULA = new Set<CurriculumCode>(['IELTS', 'CAIE', 'SAT']);
const ENGINE_TYPES = new Set<EngineType>([
  'LANGUAGE',
  'RUBRIC_ESSAY',
  'OBJECTIVE',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * JSONB / istemciden gelen ham veriyi sınav motoru sözleşmesine çevirir.
 */
export function parseAssessmentPayload(raw: unknown): AssessmentPayload {
  if (!isRecord(raw)) {
    throw new Error('Sınav verisi geçersiz.');
  }

  const curriculum = raw.curriculum;
  if (typeof curriculum !== 'string' || !CURRICULA.has(curriculum as CurriculumCode)) {
    throw new Error('Sınav müfredatı geçersiz.');
  }

  const engineType = raw.engineType;
  if (
    typeof engineType !== 'string' ||
    !ENGINE_TYPES.has(engineType as EngineType)
  ) {
    throw new Error('Sınav motor tipi geçersiz.');
  }

  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    throw new Error('Sınav en az bir soru içermelidir.');
  }

  const subject =
    typeof raw.subject === 'string' && raw.subject.trim()
      ? raw.subject.trim()
      : null;
  if (!subject) {
    throw new Error('Sınav konusu eksik.');
  }

  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : 'Değerlendirme';

  const rawDuration =
    typeof raw.durationMinutes === 'number' &&
    Number.isFinite(raw.durationMinutes) &&
    raw.durationMinutes > 0
      ? Math.trunc(raw.durationMinutes)
      : null;

  const stubForFormat: AssessmentPayload = {
    curriculum: curriculum as CurriculumCode,
    engineType: engineType as EngineType,
    subject,
    title,
    durationMinutes: rawDuration ?? 30,
    totalMarks: 0,
    questions: raw.questions as ExamQuestion[],
  };
  const format = inferSessionFormat(stubForFormat);
  const floorMinutes = minimumDurationMinutesForSession(
    format,
    curriculum as CurriculumCode,
  );

  let durationMinutes = rawDuration ?? floorMinutes;
  if (durationMinutes < floorMinutes && durationMinutes <= 90) {
    durationMinutes = floorMinutes;
  } else if (durationMinutes > 600) {
    durationMinutes = Math.max(floorMinutes, Math.round(durationMinutes / 60));
  } else {
    durationMinutes = Math.max(durationMinutes, floorMinutes);
  }

  const totalMarks =
    typeof raw.totalMarks === 'number' &&
    Number.isFinite(raw.totalMarks) &&
    raw.totalMarks > 0
      ? raw.totalMarks
      : raw.questions.length;

  const rawQuestions = raw.questions as ExamQuestion[];
  const questions =
    curriculum === 'CAIE'
      ? rawQuestions.map(ensureValidCaieQuestionRubric)
      : rawQuestions;

  return {
    curriculum: curriculum as CurriculumCode,
    engineType: engineType as EngineType,
    subject,
    title,
    durationMinutes,
    totalMarks,
    questions,
  };
}

/** Listeleme/UI: JSONB dolu mu (tam şema ayrı doğrulanır). */
export function hasStoredExamPayload(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  if (typeof raw === 'string') return raw.trim().length > 2;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.keys(raw as Record<string, unknown>).length > 0;
  }
  return false;
}

export function assessmentPayloadFromJsonb(
  raw: unknown,
): AssessmentPayload | null {
  if (raw === null || raw === undefined) return null;

  try {
    const parsed =
      typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    return parseAssessmentPayload(parsed);
  } catch {
    return null;
  }
}
