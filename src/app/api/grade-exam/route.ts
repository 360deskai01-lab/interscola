import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  ATTEMPTS_TABLE,
  PROFILES_SCHEMA,
  getSupabaseAdmin,
} from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import type {
  AssessmentPayload,
  CurriculumCode,
  EngineType,
  EvaluationResult,
  ExamQuestion,
} from '@/types/exam';

export const maxDuration = 60;

/** Rubrik değerlendirmesinde yaratıcılık değil tutarlılık isteniyor. */
const RUBRIC_TEMPERATURE = 0.1;
/**
 * Yanıt uzunluğu sınırı. Prompt'taki "kısa tut" talimatı aynı sabitten beslenir;
 * ikisi ayrı yazılsaydı zamanla birbirinden koparlardı.
 */
const MAX_OUTPUT_TOKENS = 3_072;

const CURRICULA: readonly CurriculumCode[] = ['IELTS', 'CAIE', 'SAT'];
const ENGINE_TYPES: readonly EngineType[] = [
  'LANGUAGE',
  'RUBRIC_ESSAY',
  'OBJECTIVE',
];

/**
 * SAT ölçeği: College Board 400-1600 aralığında ve 10'un katlarında puan verir.
 * Buradaki eşleme, sınav içi doğruluk oranının doğrusal izdüşümüdür; resmî
 * College Board dönüşüm tablosu DEĞİLDİR (o tablo sınav oturumuna özeldir).
 */
const SAT_MIN_SCORE = 400;
const SAT_MAX_SCORE = 1600;
const SAT_SCORE_STEP = 10;

/** IELTS bantları yalnızca yarım adımlarda tanımlıdır. */
const IELTS_MIN_BAND = 1;
const IELTS_MAX_BAND = 9;
const IELTS_HALF_STEP = 0.5;

/**
 * CAIE yüzdelik not sınırları. Gerçek sınırlar her sınav oturumunda ve her
 * bileşende ayrı ayrı açıklanır; bu tablo genel bir yaklaşımdır ve
 * değiştirilebilir olması için tek yerde tutulur.
 */
const CAIE_GRADE_BOUNDARIES: readonly { grade: string; minPercent: number }[] = [
  { grade: 'A*', minPercent: 90 },
  { grade: 'A', minPercent: 80 },
  { grade: 'B', minPercent: 70 },
  { grade: 'C', minPercent: 60 },
  { grade: 'D', minPercent: 50 },
  { grade: 'E', minPercent: 40 },
  { grade: 'U', minPercent: 0 },
];

const AO_KEYS = ['ao1_knowledge', 'ao2_application', 'ao3_evaluation'] as const;

const IELTS_KEYS = [
  'ielts_task_achievement',
  'ielts_coherence_cohesion',
  'ielts_lexical_resource',
  'ielts_grammatical_range',
] as const;

const AO_LABELS: Record<(typeof AO_KEYS)[number], string> = {
  ao1_knowledge: 'AO1',
  ao2_application: 'AO2',
  ao3_evaluation: 'AO3',
};

const IELTS_LABELS: Record<(typeof IELTS_KEYS)[number], string> = {
  ielts_task_achievement: 'Task Achievement',
  ielts_coherence_cohesion: 'Coherence & Cohesion',
  ielts_lexical_resource: 'Lexical Resource',
  ielts_grammatical_range: 'Grammatical Range',
};

type JsonRecord = Record<string, unknown>;

/** İstemciden gelen istek geçersiz: 400. */
class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

const ASSIGNMENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseOptionalAssignmentId(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  if (typeof raw !== 'string' || !ASSIGNMENT_UUID_PATTERN.test(raw)) {
    throw new RequestValidationError(
      '"assignmentId" geçerli bir UUID olmalıdır.',
    );
  }
  return raw;
}

/**
 * Atama sınavı: öğrenciye ait ve sınav payload'ı olan kaydı doğrular.
 */
async function verifyAssignmentForStudent(
  assignmentId: string,
  studentId: string,
): Promise<boolean> {
  const client = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!client) return false;

  const { data, error } = await client
    .from('assignments')
    .select('id, student_id, exam_payload')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('[grade-exam] Atama doğrulanamadı:', error.message);
    }
    return false;
  }

  const row = data as {
    student_id: string;
    exam_payload: unknown;
  };

  if (row.student_id !== studentId) {
    return false;
  }

  return row.exam_payload !== null && row.exam_payload !== undefined;
}

async function resolveAttemptOriginType(
  assignmentId: string | null,
): Promise<'self_practice' | 'assigned' | null> {
  if (!assignmentId) return null;

  const client = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!client) return null;

  const { data, error } = await client
    .from('assignments')
    .select('teacher_id')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('[grade-exam] origin_type kaynağı okunamadı:', error.message);
    }
    return null;
  }

  const teacherId = (data as { teacher_id: string | null }).teacher_id;
  return teacherId === null ? 'self_practice' : 'assigned';
}

async function markAssignmentCompleted(
  assignmentId: string,
  studentId: string,
): Promise<void> {
  const client = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!client) return;

  const { error } = await client
    .from('assignments')
    .update({ status: 'completed' })
    .eq('id', assignmentId)
    .eq('student_id', studentId)
    .in('status', ['assigned', 'in_progress']);

  if (error) {
    console.error(
      '[grade-exam] Ödev durumu güncellenemedi:',
      error.message,
    );
    return;
  }

  revalidatePath('/student/dashboard');
  revalidatePath('/teacher/dashboard');
}

/** Model şemaya uymayan çıktı üretti: 502. */
class ModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelOutputError';
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function requireString(value: unknown, field: string): string {
  const parsed = optionalString(value);
  if (!parsed) {
    throw new RequestValidationError(
      `"${field}" alanı zorunludur ve boş olamaz.`,
    );
  }
  return parsed;
}

function requirePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RequestValidationError(`"${field}" pozitif bir sayı olmalıdır.`);
  }
  return value;
}

/**
 * Sayısal alanları hem sayı hem de sayısal metin olarak kabul eder.
 * Model "6.5" döndürürse bu bir biçim farkıdır, anlam kaybı değildir.
 */
function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim().replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function roundToHalfBand(value: number): number {
  return Math.round((value + Number.EPSILON) / IELTS_HALF_STEP) * IELTS_HALF_STEP;
}

function roundToNearestTen(value: number): number {
  return Math.round(value / SAT_SCORE_STEP) * SAT_SCORE_STEP;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// İstek doğrulama
// ---------------------------------------------------------------------------

function parseQuestion(raw: unknown, index: number): ExamQuestion {
  if (!isRecord(raw)) {
    throw new RequestValidationError(
      `exam.questions[${index}] bir nesne olmalıdır.`,
    );
  }

  const rawType = raw.type;
  if (
    rawType !== 'multiple_choice' &&
    rawType !== 'extended_essay' &&
    rawType !== 'structured_text'
  ) {
    throw new RequestValidationError(
      `exam.questions[${index}].type geçersiz: ${String(rawType)}.`,
    );
  }

  const options = Array.isArray(raw.options)
    ? raw.options.filter((option): option is string => typeof option === 'string')
    : [];

  const rubricCriteria = isRecord(raw.rubricCriteria)
    ? Object.fromEntries(
        Object.entries(raw.rubricCriteria).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : undefined;

  const correctAnswer = optionalString(raw.correctAnswer);
  const explanation = optionalString(raw.explanation);

  return {
    id: requireString(raw.id, `exam.questions[${index}].id`),
    questionNumber:
      typeof raw.questionNumber === 'number' &&
      Number.isFinite(raw.questionNumber)
        ? Math.trunc(raw.questionNumber)
        : index + 1,
    prompt: requireString(raw.prompt, `exam.questions[${index}].prompt`),
    type: rawType,
    ...(options.length > 0 ? { options } : {}),
    ...(correctAnswer ? { correctAnswer } : {}),
    ...(explanation ? { explanation } : {}),
    targetMarks: requirePositiveNumber(
      raw.targetMarks,
      `exam.questions[${index}].targetMarks`,
    ),
    ...(rubricCriteria && Object.keys(rubricCriteria).length > 0
      ? { rubricCriteria }
      : {}),
  };
}

function parseExam(raw: unknown): AssessmentPayload {
  if (!isRecord(raw)) {
    throw new RequestValidationError('"exam" alanı bir nesne olmalıdır.');
  }

  const curriculum = raw.curriculum;
  if (!CURRICULA.includes(curriculum as CurriculumCode)) {
    throw new RequestValidationError(
      `exam.curriculum şunlardan biri olmalıdır: ${CURRICULA.join(', ')}.`,
    );
  }

  const engineType = raw.engineType;
  if (!ENGINE_TYPES.includes(engineType as EngineType)) {
    throw new RequestValidationError(
      `exam.engineType şunlardan biri olmalıdır: ${ENGINE_TYPES.join(', ')}.`,
    );
  }

  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    throw new RequestValidationError(
      'exam.questions en az bir soru içermelidir.',
    );
  }

  const questions = raw.questions.map(parseQuestion);
  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) {
      throw new RequestValidationError(
        `exam.questions içinde yinelenen id: "${question.id}".`,
      );
    }
    ids.add(question.id);
  }

  return {
    curriculum: curriculum as CurriculumCode,
    subject: requireString(raw.subject, 'exam.subject'),
    title: optionalString(raw.title) ?? 'Değerlendirme',
    engineType: engineType as EngineType,
    durationMinutes:
      typeof raw.durationMinutes === 'number' &&
      Number.isFinite(raw.durationMinutes) &&
      raw.durationMinutes > 0
        ? Math.trunc(raw.durationMinutes)
        : 0,
    totalMarks: requirePositiveNumber(raw.totalMarks, 'exam.totalMarks'),
    questions,
  };
}

function parseStudentAnswers(raw: unknown): Record<string, string> {
  if (raw === undefined || raw === null) {
    return {};
  }
  if (!isRecord(raw)) {
    throw new RequestValidationError('"studentAnswers" bir nesne olmalıdır.');
  }

  const entries = Object.entries(raw).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return Object.fromEntries(entries);
}

function normalizeStudentAnswersForExam(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = { ...studentAnswers };
  for (const question of exam.questions) {
    if (typeof normalized[question.id] !== 'string') {
      normalized[question.id] = '';
    }
  }
  return normalized;
}

function hasSubstantiveStudentAnswer(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
): boolean {
  return exam.questions.some((question) =>
    Boolean(optionalString(studentAnswers[question.id])),
  );
}

function evaluationForUnansweredExam(exam: AssessmentPayload): EvaluationResult {
  const remedialTopics = exam.questions.map(
    (question) =>
      `Soru ${question.questionNumber} yanıtsız — süre doldu veya boş bırakıldı. ${truncate(question.prompt, 80)}`,
  );
  const feedback =
    'Hiçbir soruya yanıt verilmedi. Ham puan 0 (%0) olarak kaydedildi; ' +
    'bir sonraki denemede süre planlamayı ve ilk sorulara erken başlamayı dene.';

  if (exam.engineType === 'OBJECTIVE') {
    const mcqCount = exam.questions.filter(
      (question) => question.type === 'multiple_choice',
    ).length;
    return {
      score: 0,
      maxScore: SAT_MAX_SCORE,
      scaledResult: `0 / ${SAT_MAX_SCORE}`,
      metricBreakdown: {
        dogru: 0,
        yanlis: 0,
        bos: mcqCount > 0 ? mcqCount : exam.questions.length,
        dogrulukYuzdesi: 0,
      },
      feedback,
      remedialTopics,
    };
  }

  if (exam.engineType === 'RUBRIC_ESSAY' || exam.curriculum === 'CAIE') {
    const mcqCount = exam.questions.filter(
      (question) => question.type === 'multiple_choice',
    ).length;
    return {
      score: 0,
      maxScore: exam.totalMarks,
      scaledResult: 'Grade U',
      metricBreakdown: {
        [AO_LABELS.ao1_knowledge]: 0,
        [AO_LABELS.ao2_application]: 0,
        [AO_LABELS.ao3_evaluation]: 0,
        yuzde: 0,
        ...(mcqCount > 0
          ? { mcqDogru: 0, mcqYanlis: 0, mcqBos: mcqCount }
          : {}),
      },
      feedback,
      remedialTopics,
    };
  }

  const metricBreakdown: Record<string, number> = { genelBand: 1, yuzde: 0 };
  for (const key of IELTS_KEYS) {
    metricBreakdown[IELTS_LABELS[key]] = IELTS_MIN_BAND;
  }

  return {
    score: IELTS_MIN_BAND,
    maxScore: IELTS_MAX_BAND,
    scaledResult: `Band ${IELTS_MIN_BAND.toFixed(1)}`,
    metricBreakdown,
    feedback,
    remedialTopics,
  };
}

async function respondGradedExam(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
  evaluation: EvaluationResult,
  studentId: string | null,
  linkedAssignmentId: string | null,
): Promise<NextResponse> {
  const attemptId = await persistAttempt(
    exam,
    studentAnswers,
    evaluation,
    studentId,
    linkedAssignmentId,
  );

  if (linkedAssignmentId && studentId) {
    await markAssignmentCompleted(linkedAssignmentId, studentId);
  }

  return NextResponse.json({
    success: true,
    evaluation,
    ...(attemptId ? { attemptId } : {}),
  });
}

// ---------------------------------------------------------------------------
// OBJECTIVE: tamamen deterministik, yapay zekâ çağrısı yok
// ---------------------------------------------------------------------------

/**
 * Öğrenci yanıtını tek bir şık harfine indirger.
 * "a", "A)", "Option B", "b." gibi varyantlar aynı anlama gelir.
 */
function normalizeChoiceAnswer(value: string | undefined): string | undefined {
  const parsed = optionalString(value);
  if (!parsed) return undefined;

  const matched = parsed.toUpperCase().match(/^(?:OPTION\s*)?([A-D])(?![A-Z0-9])/);
  return matched?.[1];
}

function gradeObjective(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
): EvaluationResult {
  const questions = exam.questions.filter(
    (question) => question.type === 'multiple_choice',
  );

  if (questions.length === 0) {
    throw new RequestValidationError(
      'OBJECTIVE motoru için sınavda hiç çoktan seçmeli soru yok.',
    );
  }

  const missingKey = questions.find((question) => !question.correctAnswer);
  if (missingKey) {
    throw new RequestValidationError(
      `Soru "${missingKey.id}" için correctAnswer tanımlı değil; otomatik puanlama yapılamaz.`,
    );
  }

  let correct = 0;
  const wrong: ExamQuestion[] = [];
  const unanswered: ExamQuestion[] = [];

  for (const question of questions) {
    const studentAnswer = normalizeChoiceAnswer(studentAnswers[question.id]);

    if (!studentAnswer) {
      unanswered.push(question);
      continue;
    }

    if (studentAnswer === normalizeChoiceAnswer(question.correctAnswer)) {
      correct += 1;
    } else {
      wrong.push(question);
    }
  }

  const total = questions.length;
  const accuracy = correct / total;
  const scaled = Math.min(
    SAT_MAX_SCORE,
    Math.max(
      SAT_MIN_SCORE,
      roundToNearestTen(
        SAT_MIN_SCORE + accuracy * (SAT_MAX_SCORE - SAT_MIN_SCORE),
      ),
    ),
  );

  const remedialTopics = [...wrong, ...unanswered].map((question) => {
    const isUnanswered = unanswered.includes(question);
    const status = isUnanswered
      ? 'boş bırakıldı'
      : `yanlış (doğru yanıt: ${normalizeChoiceAnswer(question.correctAnswer) ?? '—'})`;
    const reason = question.explanation
      ? `Açıklama: ${question.explanation}`
      : 'Bu soru için açıklama tanımlı değil.';
    return `Soru ${question.questionNumber} — ${status}. ${truncate(question.prompt, 120)} ${reason}`;
  });

  const summary = [
    `${total} sorunun ${correct} tanesi doğru`,
    wrong.length > 0 ? `${wrong.length} yanlış` : null,
    unanswered.length > 0 ? `${unanswered.length} boş` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    score: scaled,
    maxScore: SAT_MAX_SCORE,
    scaledResult: `${scaled} / ${SAT_MAX_SCORE}`,
    metricBreakdown: {
      dogru: correct,
      yanlis: wrong.length,
      bos: unanswered.length,
      dogrulukYuzdesi: roundTo2(accuracy * 100),
    },
    feedback:
      `${summary}. Bu sonuç, sınav içi doğruluk oranının ${SAT_MIN_SCORE}-${SAT_MAX_SCORE} ` +
      'aralığına doğrusal izdüşümüdür; resmî College Board dönüşüm tablosu değildir.' +
      (remedialTopics.length > 0
        ? ' Eksik kaldığın sorular aşağıda listelendi.'
        : ' Tüm soruları doğru yanıtladın.'),
    remedialTopics,
  };
}

// ---------------------------------------------------------------------------
// Rubrik değerlendirmesi (CAIE + IELTS): yapay zekâ yargı verir, kod hesaplar
// ---------------------------------------------------------------------------

function buildRubricPrompt(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
  keys: readonly string[],
  instruction: string,
): string {
  const questionsBlock = exam.questions
    .map((question) => {
      const rubric = question.rubricCriteria
        ? Object.entries(question.rubricCriteria)
            .map(([key, value]) => `    ${key}: ${value}`)
            .join('\n')
        : '    (no rubric descriptors supplied; apply the official descriptors)';

      return `QUESTION ${question.questionNumber} (id: ${question.id}, targetMarks: ${question.targetMarks})
  Prompt: ${question.prompt}
  Rubric:
${rubric}
  STUDENT ANSWER:
"""
${studentAnswers[question.id] ?? ''}
"""`;
    })
    .join('\n\n');

  return `You are a Principal Examiner for ${exam.curriculum} (${exam.subject}).

${instruction}

ASSESSMENT: ${exam.title} | Total marks: ${exam.totalMarks}

${questionsBlock}

Return ONLY a single valid JSON object, no markdown, no code fences:
{
  "questions": [
    {
      "questionId": "the exact id from above",
      "criteria": { ${keys.map((key) => `"${key}": number`).join(', ')} },
      "feedback": "constructive feedback in TURKISH, 3-6 sentences, naming specific strengths and weaknesses",
      "remedialTopics": ["specific learning objective the student failed to demonstrate, in TURKISH"]
    }
  ]
}

Rules:
1. Include exactly one entry per question, using the exact questionId values.
2. Every criterion key listed above must be present for every question.
3. Scores are numbers only, never strings, never ranges.
4. Do NOT compute averages, totals, grades or bands - only score the individual criteria.
5. "remedialTopics" must be empty ONLY if the answer is fully correct at the top band.
6. OUTPUT LENGTH LIMIT (strict): keep the whole JSON under ~${MAX_OUTPUT_TOKENS} tokens.
   "feedback" must be 2-4 sentences, "remedialTopics" at most 3 short items per question.
   Do not quote the student's answer back.`;
}

function requireCriterionScore(
  criteria: JsonRecord,
  key: string,
  questionId: string,
  min: number,
  max: number,
): number {
  const raw = toFiniteNumber(criteria[key]);
  if (raw === undefined) {
    throw new ModelOutputError(
      `"${questionId}" için "${key}" kriteri eksik veya sayı değil.`,
    );
  }

  if (raw < min || raw > max) {
    throw new ModelOutputError(
      `"${questionId}" için "${key}" kriteri ${min}-${max} aralığının dışında: ${raw}.`,
    );
  }

  // IELTS bantları yalnızca yarım adımlarda tanımlıdır; ara değerler yuvarlanır.
  return roundToHalfBand(raw);
}

interface RubricQuestionResult {
  criteria: Record<string, number>;
  feedback: string;
  remedialTopics: string[];
}

function parseRubricResponse(
  raw: JsonRecord,
  exam: AssessmentPayload,
  keys: readonly string[],
  min: number,
  max: number,
): Map<string, RubricQuestionResult> {
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    throw new ModelOutputError('Model yanıtında "questions" dizisi yok.');
  }

  const results = new Map<string, RubricQuestionResult>();

  for (const entry of raw.questions) {
    if (!isRecord(entry)) {
      throw new ModelOutputError('Model yanıtındaki soru kaydı nesne değil.');
    }

    const questionId = requireString(entry.questionId, 'questions[].questionId');
    const criteriaRaw = isRecord(entry.criteria) ? entry.criteria : {};

    const criteria: Record<string, number> = {};
    for (const key of keys) {
      criteria[key] = requireCriterionScore(criteriaRaw, key, questionId, min, max);
    }

    const remedialTopics = Array.isArray(entry.remedialTopics)
      ? entry.remedialTopics.filter(
          (topic): topic is string =>
            typeof topic === 'string' && topic.trim() !== '',
        )
      : [];

    results.set(questionId, {
      criteria,
      feedback: optionalString(entry.feedback) ?? '',
      remedialTopics,
    });
  }

  for (const question of exam.questions) {
    if (!results.has(question.id)) {
      throw new ModelOutputError(
        `Model "${question.id}" numaralı soruyu değerlendirmedi.`,
      );
    }
  }

  return results;
}

/** Sağlayıcının döndürdüğü hata; kalıcı (403/429) ve geçici ayrımını taşır. */
class ProviderError extends Error {
  /** Sağlayıcının döndürdüğü HTTP durum kodu (varsa). */
  readonly statusCode: number | undefined;
  /** Sağlayıcının ham hata mesajı; loglarda teşhis için saklanır. */
  readonly providerMessage: string | undefined;

  constructor(
    message: string,
    details?: { statusCode?: number; providerMessage?: string },
  ) {
    super(message);
    this.name = 'ProviderError';
    this.statusCode = details?.statusCode;
    this.providerMessage = details?.providerMessage;
  }
}

/** Geçici hatalar; aynı modelde tekrar denemek anlamlı olabilir. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Tek bir Gemini çağrısı için üst sınır. 25 saniyede kesilip 1 saniye bekleyip
 * yeniden denenir; toplam süre böylece 60 sn platform sınırına hiç çarpmaz.
 */
const CALL_TIMEOUT_MS = 25_000;

/**
 * Geçici sağlayıcı hatalarında en fazla kaç kez yeniden deneneceği (ilk deneme hariç).
 * Platformun 60 sn sınırına çarpmamak için tek denemeyle sınırlı.
 */
const MAX_TRANSIENT_RETRIES = 1;

/** Yeniden denemeler arasındaki sabit bekleme. */
const RETRY_DELAY_MS = 1_000;

/**
 * Tüm denemelerin toplam bütçesi. `maxDuration = 60` olduğu için 55 sn'de
 * kesiyoruz: platformun kendi timeout'una çarparsak kullanıcı hata mesajı bile
 * göremez, bu yüzden son sözü biz söylemeliyiz.
 */
const MAX_RETRY_BUDGET_MS = 55_000;

/**
 * Kalan süre bu eşiğin altındaysa yeni deneme hiç başlatılmaz:
 * yarıda kesilecek bir çağrı için beklemek kullanıcıyı boşa bekletir.
 */
const MIN_ATTEMPT_WINDOW_MS = 10_000;

/**
 * Ücretsiz katman günlük kotası dolduğunda dönen mesaj (HTTP 429).
 * Bu kalıcı bir durumdur; retry ve "birkaç saniye sonra dene" yanıltıcı olur.
 */
const QUOTA_EXCEEDED_MESSAGE =
  'Google Gemini günlük ücretsiz kullanım kotası doldu.';

/**
 * Anahtarın modele/servise erişim izni olmadığında dönen mesaj (HTTP 403).
 * Aynı modelde tekrar denemek sonucu değiştirmez.
 */
const PERMISSION_DENIED_MESSAGE =
  'Google Gemini API yetkilendirme hatası (403 PERMISSION_DENIED). ' +
  'Lütfen geçerli bir API anahtarı kullanın.';

/** Kullanılan tek model. Google AI Studio kataloğuyla doğrulandı. */
const MODEL = 'gemini-3.6-flash';

/** `AbortSignal.timeout()` iptali tarayıcıda/Node'da farklı isimlerle gelir. */
const TIMEOUT_ERROR_NAMES = new Set(['TimeoutError', 'AbortError']);

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && TIMEOUT_ERROR_NAMES.has(error.name);
}

function errorStatusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if (!('status' in error)) return undefined;
  const status = Number((error as { status: unknown }).status);
  return Number.isFinite(status) ? status : undefined;
}

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Gemini çağrısındaki hatayı sınıflandırır.
 * SDK bir `ApiError` fırlatır ve `status` alanında HTTP kodunu taşır.
 * Teşhis için durum kodu ve sağlayıcının ham mesajı korunur.
 */
function toProviderError(error: unknown): never {
  if (error instanceof ProviderError) throw error;

  if (isTimeoutError(error)) {
    throw new ProviderError(
      `Gemini çağrısı zaman aşımına düştü (model: ${MODEL}).`,
      { providerMessage: errorMessageOf(error) },
    );
  }

  const status = errorStatusOf(error);

  if (status !== undefined && RETRYABLE_STATUS.has(status)) {
    throw new ProviderError(
      `Sağlayıcı geçici hata döndürdü (HTTP ${status}, model: ${MODEL}).`,
      { statusCode: status, providerMessage: errorMessageOf(error) },
    );
  }

  throw error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiForRubricRaw(
  ai: GoogleGenAI,
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
  keys: readonly string[],
  instruction: string,
  timeoutMs: number,
): Promise<JsonRecord> {
  let response: Awaited<ReturnType<typeof ai.models.generateContent>>;

  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: buildRubricPrompt(exam, studentAnswers, keys, instruction),
      config: {
        responseMimeType: 'application/json',
        temperature: RUBRIC_TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // Çağrı takılırsa bütçe sınırına çarpmadan kendimiz iptal ederiz.
        abortSignal: AbortSignal.timeout(timeoutMs),
      },
    });
  } catch (error) {
    // Zaman aşımı ve SDK'nın fırlattığı 403/429/503 gibi hatalar burada sınıflandırılır.
    if (isTimeoutError(error)) {
      console.error(
        `[API] İstek ${CALL_TIMEOUT_MS / 1000} sn zaman aşımına uğradı, retry bütçesi kontrol ediliyor`,
      );
    }
    toProviderError(error);
  }

  const text = response.text;
  if (!text) {
    throw new ModelOutputError('Model boş yanıt döndürdü.');
  }

  const cleaned = text
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new ModelOutputError('Model yanıtı geçerli bir JSON nesnesi içermiyor.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new ModelOutputError('Model yanıtındaki JSON ayrıştırılamadı.');
  }

  if (!isRecord(parsed)) {
    throw new ModelOutputError(
      'Model yanıtı beklenen JSON nesnesi biçiminde değil.',
    );
  }

  return parsed;
}

/**
 * Tek model üzerinde, geçici hatalarda sınırlı sayıda yeniden deneme yapar.
 *
 * Kalıcı hatalar (403 yetki, 429 kota) için retry YAPILMAZ: ikisi de
 * deterministiktir ve tekrar denemek yalnızca kullanıcıyı bekletir.
 *
 * Bütçe yönetimi: toplam süre `MAX_RETRY_BUDGET_MS`'i aşamaz. Her deneme kalan
 * süreyle sınırlanır, böylece platformun 60 sn sınırına hiçbir koşulda çarpılmaz.
 */
async function callGeminiForRubric(
  ai: GoogleGenAI,
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
  keys: readonly string[],
  instruction: string,
): Promise<JsonRecord> {
  const deadline = Date.now() + MAX_RETRY_BUDGET_MS;
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
    const isLastAttempt = attempt === MAX_TRANSIENT_RETRIES;
    const timeoutMs = Math.min(CALL_TIMEOUT_MS, deadline - Date.now());

    if (timeoutMs < MIN_ATTEMPT_WINDOW_MS) {
      console.warn(
        `[grade-exam] Kalan bütçe yetersiz ` +
          `(${Math.max(0, Math.round(timeoutMs / 1000))} sn), yeni deneme başlatılmayacak.`,
      );
      break;
    }

    console.info(
      `[grade-exam] Deneme ${attempt + 1}/${MAX_TRANSIENT_RETRIES + 1} ` +
        `(model: ${MODEL}, timeout: ${Math.round(timeoutMs / 1000)} sn)`,
    );

    try {
      return await callGeminiForRubricRaw(
        ai,
        exam,
        studentAnswers,
        keys,
        instruction,
        timeoutMs,
      );
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;

      lastError = error;

      // 403 ve 429 kalıcıdır: retry sonucu değiştirmez, doğrudan fırlat.
      if (error.statusCode === 403 || error.statusCode === 429) {
        console.warn(
          `[grade-exam] Kalıcı hata (HTTP ${error.statusCode}), retry yapılmayacak:`,
          error.providerMessage ?? error.message,
        );
        throw error;
      }

      if (isLastAttempt) break;

      const afterDelay = deadline - Date.now() - RETRY_DELAY_MS;
      if (afterDelay < MIN_ATTEMPT_WINDOW_MS) {
        console.warn(
          '[grade-exam] Retry için yeterli bütçe kalmadı, durduruluyor:',
          error.message,
        );
        break;
      }

      console.warn(
        `[grade-exam] Geçici hata, ${RETRY_DELAY_MS} ms sonra tekrar denenecek:`,
        error.message,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw (
    lastError ??
    new ProviderError('Model geçici olarak yanıt veremedi.')
  );
}

function requireAnswerForQuestions(
  questions: ExamQuestion[],
  studentAnswers: Record<string, string>,
): void {
  for (const question of questions) {
    if (!optionalString(studentAnswers[question.id])) {
      throw new RequestValidationError(
        `"${question.id}" numaralı soru için öğrenci yanıtı boş; rubrik değerlendirmesi metin gerektirir.`,
      );
    }
  }
}

function requireAnswerForEveryQuestion(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
): void {
  requireAnswerForQuestions(exam.questions, studentAnswers);
}

/**
 * CAIE / RUBRIC_ESSAY karışık sınavlarda MCQ: tam hedef puan veya sıfır.
 */
function gradeMultipleChoiceQuestions(
  questions: ExamQuestion[],
  studentAnswers: Record<string, string>,
): {
  score: number;
  feedbackParts: string[];
  remedialTopics: string[];
  metricBreakdown: Record<string, number>;
} {
  if (questions.length === 0) {
    return {
      score: 0,
      feedbackParts: [],
      remedialTopics: [],
      metricBreakdown: { mcqDogru: 0, mcqYanlis: 0, mcqBos: 0 },
    };
  }

  const missingKey = questions.find((question) => !question.correctAnswer);
  if (missingKey) {
    throw new RequestValidationError(
      `Soru "${missingKey.id}" için correctAnswer tanımlı değil; MCQ puanlanamaz.`,
    );
  }

  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let score = 0;
  const feedbackParts: string[] = [];
  const remedialTopics: string[] = [];

  for (const question of questions) {
    const studentAnswer = normalizeChoiceAnswer(studentAnswers[question.id]);
    const expected = normalizeChoiceAnswer(question.correctAnswer);

    if (!studentAnswer) {
      blank += 1;
      remedialTopics.push(
        `Soru ${question.questionNumber} (MCQ) boş bırakıldı — ${truncate(question.prompt, 100)}`,
      );
      continue;
    }

    if (studentAnswer === expected) {
      correct += 1;
      score += question.targetMarks;
      feedbackParts.push(
        `Soru ${question.questionNumber} (MCQ): doğru (+${question.targetMarks} puan).`,
      );
    } else {
      wrong += 1;
      remedialTopics.push(
        `Soru ${question.questionNumber} (MCQ) yanlış — doğru şık ${expected ?? '—'}. ${truncate(question.prompt, 100)}`,
      );
    }
  }

  return {
    score: roundTo2(score),
    feedbackParts,
    remedialTopics,
    metricBreakdown: {
      mcqDogru: correct,
      mcqYanlis: wrong,
      mcqBos: blank,
    },
  };
}

// ---------------------------------------------------------------------------
// CAIE
// ---------------------------------------------------------------------------

const CAIE_INSTRUCTION = `Assess each answer against the official Cambridge Assessment International Education
Assessment Objectives, exactly as a Principal Examiner marking to a published mark scheme:
- ao1_knowledge: AO1 - knowledge and understanding of the material
- ao2_application: AO2 - application of knowledge to the question's demands
- ao3_evaluation: AO3 - analysis, evaluation and justified conclusions

For EACH question, award marks for each AO on a scale from 0 up to that question's targetMarks.
The three AO marks for a question SHOULD sum to approximately its targetMarks
(AO1 normally carries the largest share, AO3 the smallest for extended-response questions).
Be strict: a descriptive answer that never evaluates must score near zero on AO3.`;

function caieGradeFromPercent(percent: number): string {
  const boundary = CAIE_GRADE_BOUNDARIES.find(
    (entry) => percent >= entry.minPercent,
  );
  return boundary?.grade ?? 'U';
}

async function gradeRubricEssay(
  ai: GoogleGenAI,
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
): Promise<EvaluationResult> {
  const usesCaieRules =
    exam.curriculum === 'CAIE' || exam.engineType === 'RUBRIC_ESSAY';

  const mcqQuestions = usesCaieRules
    ? exam.questions.filter((question) => question.type === 'multiple_choice')
    : [];
  const openQuestions = usesCaieRules
    ? exam.questions.filter((question) => question.type !== 'multiple_choice')
    : exam.questions;

  if (openQuestions.length === 0 && mcqQuestions.length === 0) {
    throw new RequestValidationError('Sınavda puanlanabilir soru bulunamadı.');
  }

  const mcqResult = gradeMultipleChoiceQuestions(mcqQuestions, studentAnswers);

  const totals: Record<(typeof AO_KEYS)[number], number> = {
    ao1_knowledge: 0,
    ao2_application: 0,
    ao3_evaluation: 0,
  };

  const feedbackParts: string[] = [...mcqResult.feedbackParts];
  const remedialTopics: string[] = [...mcqResult.remedialTopics];
  let cappedQuestions = 0;
  let openResponseScore = 0;

  if (openQuestions.length > 0) {
    requireAnswerForQuestions(openQuestions, studentAnswers);

    const openExam: AssessmentPayload = {
      ...exam,
      questions: openQuestions,
    };

    const raw = await callGeminiForRubric(
      ai,
      openExam,
      studentAnswers,
      AO_KEYS,
      CAIE_INSTRUCTION,
    );

    const maxTargetMarks = Math.max(
      ...openQuestions.map((question) => question.targetMarks),
    );

    const parsed = parseRubricResponse(
      raw,
      openExam,
      AO_KEYS,
      0,
      maxTargetMarks,
    );

    for (const question of openQuestions) {
      const result = parsed.get(question.id);
      if (!result) continue;

      const awarded = AO_KEYS.reduce(
        (sum, key) => sum + result.criteria[key],
        0,
      );

      const factor =
        awarded > question.targetMarks ? question.targetMarks / awarded : 1;

      if (factor !== 1) {
        cappedQuestions += 1;
        console.warn(
          `[grade-exam] ${question.id}: AO toplamı ${awarded}, hedef ${question.targetMarks}; ` +
            `üst sınırı aştığı için ${factor.toFixed(3)} katsayısıyla sınırlandı.`,
        );
      }

      for (const key of AO_KEYS) {
        totals[key] += result.criteria[key] * factor;
      }

      if (result.feedback) {
        feedbackParts.push(`Soru ${question.questionNumber}: ${result.feedback}`);
      }
      remedialTopics.push(...result.remedialTopics);
    }

    openResponseScore = AO_KEYS.reduce((sum, key) => sum + totals[key], 0);
  }

  const combinedRaw = mcqResult.score + openResponseScore;
  const score = roundTo2(Math.min(combinedRaw, exam.totalMarks));
  const percent = (score / exam.totalMarks) * 100;
  const grade = caieGradeFromPercent(percent);

  const capNote =
    cappedQuestions > 0
      ? ` (${cappedQuestions} açık uçlu soruda modelin AO puanları soru puanını aştığı için üst sınıra çekildi.)`
      : '';

  const metricBreakdown: Record<string, number> = {
    [AO_LABELS.ao1_knowledge]: roundTo2(totals.ao1_knowledge),
    [AO_LABELS.ao2_application]: roundTo2(totals.ao2_application),
    [AO_LABELS.ao3_evaluation]: roundTo2(totals.ao3_evaluation),
    yuzde: roundTo2(percent),
  };

  if (mcqQuestions.length > 0) {
    Object.assign(metricBreakdown, mcqResult.metricBreakdown);
  }

  return {
    score,
    maxScore: exam.totalMarks,
    scaledResult: `Grade ${grade}`,
    metricBreakdown,
    feedback:
      `${feedbackParts.join(' ')} Toplam ${score}/${exam.totalMarks} puan ` +
      `(%${roundTo2(percent)}) ile Grade ${grade} bandına karşılık gelir.${capNote} ` +
      'Not sınırları yaklaşık değerlerdir; gerçek CAIE sınırları her sınav ' +
      'oturumunda ayrıca açıklanır.',
    remedialTopics,
  };
}

// ---------------------------------------------------------------------------
// IELTS
// ---------------------------------------------------------------------------

const IELTS_INSTRUCTION = `Assess each response against the four official IELTS writing band descriptors.
Award a band from 1 to 9 for each criterion, using whole or half bands only:
- ielts_task_achievement: Task Achievement / Task Response
- ielts_coherence_cohesion: Coherence and Cohesion
- ielts_lexical_resource: Lexical Resource
- ielts_grammatical_range: Grammatical Range and Accuracy

Be strict and realistic. Band 9 is near-native and essentially flawless; band 5 indicates
noticeable limitations. Do not inflate scores for effort, length or ambition.`;

async function gradeLanguage(
  ai: GoogleGenAI,
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
): Promise<EvaluationResult> {
  requireAnswerForEveryQuestion(exam, studentAnswers);

  const raw = await callGeminiForRubric(
    ai,
    exam,
    studentAnswers,
    IELTS_KEYS,
    IELTS_INSTRUCTION,
  );

  const parsed = parseRubricResponse(
    raw,
    exam,
    IELTS_KEYS,
    IELTS_MIN_BAND,
    IELTS_MAX_BAND,
  );

  const criterionTotals: Record<(typeof IELTS_KEYS)[number], number> = {
    ielts_task_achievement: 0,
    ielts_coherence_cohesion: 0,
    ielts_lexical_resource: 0,
    ielts_grammatical_range: 0,
  };

  const feedbackParts: string[] = [];
  const remedialTopics: string[] = [];

  for (const question of exam.questions) {
    const result = parsed.get(question.id);
    if (!result) continue;

    for (const key of IELTS_KEYS) {
      criterionTotals[key] += result.criteria[key];
    }
    if (result.feedback) {
      feedbackParts.push(`Soru ${question.questionNumber}: ${result.feedback}`);
    }
    remedialTopics.push(...result.remedialTopics);
  }

  const questionCount = exam.questions.length;
  const criterionBands = IELTS_KEYS.map((key) =>
    roundToHalfBand(criterionTotals[key] / questionCount),
  );

  const overallBand = roundToHalfBand(
    criterionBands.reduce((sum, band) => sum + band, 0) / IELTS_KEYS.length,
  );

  const metricBreakdown: Record<string, number> = {};
  IELTS_KEYS.forEach((key, index) => {
    metricBreakdown[IELTS_LABELS[key]] = criterionBands[index];
  });

  return {
    score: overallBand,
    maxScore: IELTS_MAX_BAND,
    scaledResult: `Band ${overallBand.toFixed(1)}`,
    metricBreakdown: { ...metricBreakdown, genelBand: overallBand },
    feedback:
      `${feedbackParts.join(' ')} Dört kriterin ortalaması ${overallBand.toFixed(1)} ` +
      'bandına karşılık gelir. Değerlendirme resmî IELTS band tanımlayıcılarına ' +
      'göre yapılmıştır.',
    remedialTopics,
  };
}

/**
 * Değerlendirme sonucunu veritabanına kaydeder.
 *
 * KALICI HATA NOKTASI DEĞİLDİR: bu fonksiyon asla throw etmez. Kayıt başarısız
 * olsa bile öğrenci karnesini görmelidir; kalıcılık ikincil bir kaygıdır.
 * Dönen değer yalnızca loglama/teşhis içindir.
 */
async function persistAttempt(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
  evaluation: EvaluationResult,
  studentId: string | null,
  assignmentId: string | null,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  const percentage =
    evaluation.maxScore > 0
      ? roundTo2((evaluation.score / evaluation.maxScore) * 100)
      : 0;

  const originType = await resolveAttemptOriginType(assignmentId);

  const row: Record<string, unknown> = {
    curriculum: exam.curriculum,
    subject: exam.subject,
    exam_title: exam.title,
    engine_type: exam.engineType,
    raw_score: evaluation.score,
    max_score: evaluation.maxScore,
    percentage,
    scaled_result: evaluation.scaledResult,
    metric_breakdown: evaluation.metricBreakdown,
    student_answers: studentAnswers,
    evaluations: {
      feedback: evaluation.feedback,
      remedialTopics: evaluation.remedialTopics,
      metricBreakdown: evaluation.metricBreakdown,
    },
    student_id: studentId,
    ...(assignmentId ? { assignment_id: assignmentId } : {}),
    ...(originType ? { origin_type: originType } : {}),
  };

  try {
    const { data, error } = await supabase
      .from(ATTEMPTS_TABLE)
      .insert(row)
      .select('id')
      .single();

    const insertError = error;

    if (insertError) {
      console.error('[grade-exam] Supabase Kayıt Hatası:', insertError);
      console.error('[grade-exam] Kayıt bağlamı:', {
        table: ATTEMPTS_TABLE,
        columns: Object.keys(row),
        code: insertError.code ?? 'yok',
        message: insertError.message,
        details: insertError.details ?? 'yok',
        hint: insertError.hint ?? 'yok',
      });

      /*
       * Kolon uyumsuzluğu (ör. `student_id` henüz eklenmemiş) tüm kaydı
       * düşürmemeli. Bu durumda öğrenci kimliği olmadan yeniden denenir;
       * geçmiş özelliği çalışmaya devam eder, yalnızca izolasyon kaybı olur.
       */
      if (isMissingColumnError(insertError)) {
        console.warn(
          '[grade-exam] Şema uyumsuzluğu: geçici olarak student_id olmadan kaydedilecek.',
        );
        return await insertWithoutOptionalColumns(supabase, row, [
          'student_id',
          'assignment_id',
          'origin_type',
        ]);
      }

      return null;
    }

    const id =
      typeof data === 'object' && data !== null && 'id' in data
        ? String((data as { id: unknown }).id)
        : null;

    console.info('[grade-exam] Deneme kaydedildi:', { id });
    return id;
  } catch (error) {
    console.error('[grade-exam] Supabase Kayıt Hatası:', error);
    return null;
  }
}

/**
 * Postgres "undefined_column" (42703) veya PostgREST şema önbelleği hatasını
 * tanır. Bu durumda kolonu düşürüp yeniden denemek güvenlidir.
 */
function isMissingColumnError(
  error: { code?: string; message?: string; details?: string },
): boolean {
  const haystack = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    haystack.includes('student_id') ||
    haystack.includes('assignment_id') ||
    haystack.includes('origin_type') ||
    haystack.includes('column') ||
    haystack.includes('schema cache')
  );
}

/** Eksik kolonlar düşürülerek yeniden insert (şema geriye uyumluluk). */
async function insertWithoutOptionalColumns(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  row: Record<string, unknown>,
  omitKeys: string[],
): Promise<string | null> {
  const legacyRow = { ...row };
  for (const key of omitKeys) {
    delete legacyRow[key];
  }

  try {
    const { data, error } = await supabase
      .from(ATTEMPTS_TABLE)
      .insert(legacyRow)
      .select('id')
      .single();

    if (error) {
      if (isMissingColumnError(error) && omitKeys.length < 4) {
        return insertWithoutOptionalColumns(
          supabase,
          row,
          [...omitKeys, 'assignment_id', 'student_id'].filter(
            (key, index, arr) => arr.indexOf(key) === index && key in row,
          ),
        );
      }
      console.error(
        '[grade-exam] Supabase Kayıt Hatası (legacy insert):',
        error,
      );
      return null;
    }

    return typeof data === 'object' && data !== null && 'id' in data
      ? String((data as { id: unknown }).id)
      : null;
  } catch (error) {
    console.error('[grade-exam] Supabase Kayıt Hatası:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let exam: AssessmentPayload;
  let studentAnswers: Record<string, string>;
  let assignmentId: string | null = null;

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      throw new RequestValidationError('İstek gövdesi bir nesne olmalıdır.');
    }
    exam = parseExam(body.exam);
    studentAnswers = normalizeStudentAnswersForExam(
      exam,
      parseStudentAnswers(body.studentAnswers),
    );
    assignmentId = parseOptionalAssignmentId(body.assignmentId);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse('İstek gövdesi geçerli bir JSON değil.', 400);
    }
    if (error instanceof RequestValidationError) {
      return errorResponse(error.message, 400);
    }
    return errorResponse('İstek doğrulanamadı.', 400);
  }

  // Oturum varsa deneme o kullanıcıya bağlanır; yoksa anonim kalır.
  const sessionUser = await getSessionUser();
  const studentId = sessionUser?.id ?? null;

  let linkedAssignmentId: string | null = null;
  if (assignmentId) {
    if (!studentId) {
      return errorResponse(
        'Atama sınavı için oturum açmış olmalısın.',
        401,
      );
    }
    const allowed = await verifyAssignmentForStudent(
      assignmentId,
      studentId,
    );
    if (!allowed) {
      return errorResponse('Bu ödev sınavına erişim yok.', 403);
    }
    linkedAssignmentId = assignmentId;
  }

  const unansweredSubmission = !hasSubstantiveStudentAnswer(exam, studentAnswers);

  // OBJECTIVE yolu deterministiktir: API anahtarı ve yapay zekâ çağrısı gerekmez.
  if (exam.engineType === 'OBJECTIVE') {
    try {
      const evaluation = unansweredSubmission
        ? evaluationForUnansweredExam(exam)
        : gradeObjective(exam, studentAnswers);
      return respondGradedExam(
        exam,
        studentAnswers,
        evaluation,
        studentId,
        linkedAssignmentId,
      );
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return errorResponse(error.message, 400);
      }
      console.error('[grade-exam] OBJECTIVE puanlaması başarısız:', error);
      return errorResponse(
        'Puanlama sırasında beklenmeyen bir hata oluştu.',
        500,
      );
    }
  }

  if (unansweredSubmission) {
    return respondGradedExam(
      exam,
      studentAnswers,
      evaluationForUnansweredExam(exam),
      studentId,
      linkedAssignmentId,
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorResponse(
      'GEMINI_API_KEY ortam değişkeni tanımlı değil. Sunucu yapılandırmasını kontrol edin.',
      500,
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const evaluation =
      exam.engineType === 'RUBRIC_ESSAY'
        ? await gradeRubricEssay(ai, exam, studentAnswers)
        : await gradeLanguage(ai, exam, studentAnswers);

    return respondGradedExam(
      exam,
      studentAnswers,
      evaluation,
      studentId,
      linkedAssignmentId,
    );
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(error.message, 400);
    }

    if (error instanceof ProviderError) {
      console.error(
        '[grade-exam] Sağlayıcı hatası.',
        {
          model: MODEL,
          statusCode: error.statusCode ?? 'yok',
          message: error.message,
          providerMessage: error.providerMessage ?? 'yok',
        },
      );

      // Kalıcı hatalar kendi mesajlarıyla döner; kullanıcıya yanlış yönlendirme yapılmaz.
      if (error.statusCode === 403) {
        return errorResponse(PERMISSION_DENIED_MESSAGE, 503);
      }
      if (error.statusCode === 429) {
        return errorResponse(QUOTA_EXCEEDED_MESSAGE, 503);
      }

      return errorResponse(
        'Değerlendirme motoru şu anda yoğun; birkaç saniye sonra tekrar dene.',
        503,
      );
    }

    if (error instanceof ModelOutputError) {
      console.error('[grade-exam] Model şema ihlali.', {
        model: MODEL,
        message: error.message,
      });
      return errorResponse(
        `Model beklenen değerlendirme şemasına uymayan bir yanıt üretti: ${error.message}`,
        502,
      );
    }

    console.error('[grade-exam] Değerlendirme başarısız:', error);
    return errorResponse(
      'Değerlendirme sırasında beklenmeyen bir hata oluştu.',
      500,
    );
  }
}
