import type {
  AssessmentPayload,
  CurriculumCode,
  EngineType,
} from '@/types/exam';

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

  const durationMinutes =
    typeof raw.durationMinutes === 'number' &&
    Number.isFinite(raw.durationMinutes) &&
    raw.durationMinutes > 0
      ? Math.trunc(raw.durationMinutes)
      : 30;

  const totalMarks =
    typeof raw.totalMarks === 'number' &&
    Number.isFinite(raw.totalMarks) &&
    raw.totalMarks > 0
      ? raw.totalMarks
      : raw.questions.length;

  return {
    curriculum: curriculum as CurriculumCode,
    engineType: engineType as EngineType,
    subject,
    title,
    durationMinutes,
    totalMarks,
    questions: raw.questions as AssessmentPayload['questions'],
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
