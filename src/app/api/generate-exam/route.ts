import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type {
  AssessmentPayload,
  CurriculumCode,
  EngineType,
  ExamQuestion,
} from '@/types/exam';

export const maxDuration = 60;

const CURRICULA: readonly CurriculumCode[] = ['IELTS', 'CAIE', 'SAT'];
const ENGINE_TYPES: readonly EngineType[] = [
  'LANGUAGE',
  'RUBRIC_ESSAY',
  'OBJECTIVE',
];

const DEFAULT_QUESTION_COUNT = 2;
const MIN_QUESTION_COUNT = 1;
/** Token aşımı ve gecikmeyi önlemek için üst sınır. */
const MAX_QUESTION_COUNT = 12;

/** OBJECTIVE sorularda beklenen şık sayısı. */
const OBJECTIVE_OPTION_COUNT = 4;

/** Gemini'ye gönderilen kullanıcı metni için üst sınır (karakter). */
const MAX_PROMPT_CONTEXT_CHARS = 15_000;

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
 * Kalan süre bu eşiğin altındaysa yeniden deneme hiç başlatılmaz:
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

/** Birincil üretim modeli (yoğunluk/503 veya kota/429 sonrası yedek modele düşülür). */
const MODEL_PRIMARY = 'gemini-3.6-flash';
/** Yoğun küme veya kota yanıtından sonra tek deneme için yedek model. */
const MODEL_FALLBACK = 'gemini-2.5-flash';
/** 503/429 sonrası yedek modele geçmeden önce bekleme (ms). */
const MODEL_FALLBACK_BACKOFF_MS = 2_000;

const MODEL_LINE_FOR_LOG = `${MODEL_PRIMARY} (yedek: ${MODEL_FALLBACK})`;

/**
 * Yanıt uzunluğu sınırı. Prompt'taki "kısa tut" talimatı bu değerle aynı
 * kaynaktan beslenir; ikisi ayrı yazılsaydı zamanla birbirinden koparlardı.
 */
const MAX_OUTPUT_TOKENS = 3_072;
/** Çok sorulu OBJECTIVE paketlerinde kesilme riskini azaltır. */
const MAX_OUTPUT_TOKENS_CAP = 8_192;

/** Çıktının hedeflenen yaklaşık token bütçesi (prompt'ta modele bildirilir). */
const BRIEF_TOKEN_LIMIT = MAX_OUTPUT_TOKENS;

/** Aynı modelde tekrar denemek anlamsız: zaman aşımı dışındaki geçici hatalar. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface GenerateExamRequest {
  curriculum: CurriculumCode;
  subject: string;
  engineType: EngineType;
  promptContext?: string;
  questionCount?: number;
}

type JsonRecord = Record<string, unknown>;

/**
 * Modelin şemaya uymayan çıktı üretmesi durumunda fırlatılır.
 * Altyapı hatasından ayırt edilebilsin diye ayrı bir tip.
 */
export class ModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelOutputError';
  }
}

/**
 * Modelin istenen sayıda soru üretmemesi. Diğer şema ihlallerinden ayrı tutulur
 * çünkü yalnızca bu durumda otomatik yeniden deneme anlamlıdır.
 */
export class QuestionCountMismatchError extends ModelOutputError {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionCountMismatchError';
  }
}

/** Sağlayıcının döndürdüğü hata; kalıcı (403/429) ve geçici ayrımını taşır. */
export class ProviderError extends Error {
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
function toProviderError(error: unknown, modelLabel?: string): never {
  if (error instanceof ProviderError) throw error;

  const label = modelLabel ?? MODEL_PRIMARY;

  if (isTimeoutError(error)) {
    throw new ProviderError(
      `Gemini çağrısı zaman aşımına düştü (model: ${label}).`,
      { providerMessage: errorMessageOf(error) },
    );
  }

  const status = errorStatusOf(error);

  if (status !== undefined && RETRYABLE_STATUS.has(status)) {
    throw new ProviderError(
      `Sağlayıcı geçici hata döndürdü (HTTP ${status}, model: ${label}).`,
      { statusCode: status, providerMessage: errorMessageOf(error) },
    );
  }

  throw error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContentWithPrimaryThenFallback(
  ai: GoogleGenAI,
  args: {
    contents: ReturnType<typeof buildPrompt>;
    maxOutputTokens: number;
    attemptTimeout: number;
  },
): Promise<Awaited<ReturnType<typeof ai.models.generateContent>>> {
  try {
    return await ai.models.generateContent({
      model: MODEL_PRIMARY,
      contents: args.contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: args.maxOutputTokens,
        abortSignal: AbortSignal.timeout(args.attemptTimeout),
      },
    });
  } catch (error) {
    const status = errorStatusOf(error);
    if (status === 503 || status === 429) {
      console.warn(
        `[generate-exam] Birincil model yoğun/kotada (HTTP ${status}), ` +
          `${MODEL_FALLBACK_BACKOFF_MS} ms bekleyip yedek model deneniyor: ${MODEL_FALLBACK}`,
      );
      await sleep(MODEL_FALLBACK_BACKOFF_MS);
      try {
        return await ai.models.generateContent({
          model: MODEL_FALLBACK,
          contents: args.contents,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: args.maxOutputTokens,
            abortSignal: AbortSignal.timeout(args.attemptTimeout),
          },
        });
      } catch (fallbackError) {
        toProviderError(fallbackError, MODEL_FALLBACK);
      }
    }
    toProviderError(error, MODEL_PRIMARY);
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
    throw new Error(`"${field}" alanı zorunludur ve boş olamaz.`);
  }
  return parsed;
}

/** Model çıktısındaki zorunlu alanlar için: hata 502 olarak raporlanır. */
function requireModelString(value: unknown, field: string): string {
  const parsed = optionalString(value);
  if (!parsed) {
    throw new ModelOutputError(
      `Model yanıtında "${field}" alanı eksik veya boş.`,
    );
  }
  return parsed;
}

function parseRequestBody(body: unknown): GenerateExamRequest {
  if (!isRecord(body)) {
    throw new Error('Geçersiz istek gövdesi.');
  }

  const curriculum = body.curriculum;
  if (!CURRICULA.includes(curriculum as CurriculumCode)) {
    throw new Error(
      `"curriculum" alanı şunlardan biri olmalıdır: ${CURRICULA.join(', ')}.`,
    );
  }

  const engineType = body.engineType;
  if (!ENGINE_TYPES.includes(engineType as EngineType)) {
    throw new Error(
      `"engineType" alanı şunlardan biri olmalıdır: ${ENGINE_TYPES.join(', ')}.`,
    );
  }

  const rawCount = body.questionCount;
  const questionCount =
    typeof rawCount === 'number' && Number.isFinite(rawCount)
      ? Math.min(
          MAX_QUESTION_COUNT,
          Math.max(MIN_QUESTION_COUNT, Math.trunc(rawCount)),
        )
      : DEFAULT_QUESTION_COUNT;

  const promptContext = optionalString(body.promptContext);

  return {
    curriculum: curriculum as CurriculumCode,
    engineType: engineType as EngineType,
    subject: requireString(body.subject, 'subject'),
    questionCount,
    ...(promptContext
      ? { promptContext: promptContext.slice(0, MAX_PROMPT_CONTEXT_CHARS) }
      : {}),
  };
}

function curriculumBlueprint(
  curriculum: CurriculumCode,
  engineType: EngineType,
): string {
  if (curriculum === 'IELTS') {
    return `CURRICULUM: IELTS Academic (LANGUAGE engine).
- Produce ${
      engineType === 'LANGUAGE' ? 'Task 1 or Task 2' : 'Task 2'
    } writing composition prompts in authentic IELTS wording.
- Each question is a single writing task the candidate must answer in continuous prose. Use type "extended_essay".
- Scoring must follow the official IELTS band descriptors on a Band 1-9 scale. For every question fill rubricCriteria with:
  "ielts_task_achievement" (Task Achievement / Task Response, Band 1-9),
  "ielts_coherence_cohesion" (Coherence and Cohesion, Band 1-9),
  "ielts_lexical_resource" (Lexical Resource, Band 1-9),
  "ielts_grammatical_range" (Grammatical Range and Accuracy, Band 1-9).
- Each band descriptor string must state what Band 7, Band 6 and Band 5 performance looks like for that criterion.
- targetMarks is the raw word-count-agnostic writing score floor: set it to 9 (one point per band step).`;
  }

  if (curriculum === 'CAIE') {
    return `CURRICULUM: Cambridge Assessment International Education (CAIE) A-Level 9990-style Psychology / essay-based subjects (RUBRIC_ESSAY engine).
- Produce open-ended extended-response and scenario-based questions in official Cambridge command-word style (e.g. "Explain", "Discuss", "Evaluate", "Assess").
- Every question must be answerable in continuous prose; use type "extended_essay" for essay questions and "structured_text" for scaffolded scenario questions that expect short structured answers.
- Marks must follow Cambridge conventions: 2, 4, 8, 10 or 12 marks per question part, matching the command word.
- For every question fill rubricCriteria with the official Assessment Objective mark scheme:
  "ao1_knowledge" (AO1 - Knowledge and understanding),
  "ao2_application" (AO2 - Application of knowledge to novel scenarios),
  "ao3_evaluation" (AO3 - Analysis, evaluation and justified conclusion).
- Each AO string must describe the banded mark allocation for that AO (top band, middle band, bottom band) exactly as a Cambridge Principal Examiner mark scheme would.`;
  }

  return `CURRICULUM: SAT (College Board, OBJECTIVE engine).
- Produce passage-based multiple-choice questions in official Digital SAT format.
- Each question must have exactly 4 answer options, labelled "A)", "B)", "C)" and "D)", with exactly one correct answer.
- If a stimulus passage is needed, embed it inside the "prompt" field before the question stem.
- Use type "multiple_choice" for every question and set targetMarks to 1.
- MANDATORY for every question: set "correctAnswer" to the single letter of the correct option ("A", "B", "C" or "D") - never the option text, never a phrase. Set "explanation" to a concise rationale (2-3 sentences) stating why that option is correct and why the strongest distractor is wrong.
- Do NOT include any rubricCriteria for SAT questions.`;
}

function engineBluePrint(engineType: EngineType): string {
  if (engineType === 'OBJECTIVE') {
    return `ENGINE: OBJECTIVE - auto-scorable multiple choice. Every question is "multiple_choice" with exactly 4 options ("A)", "B)", "C)", "D)"), a single unambiguous correct answer, and both "correctAnswer" and "explanation" are REQUIRED fields for every question.`;
  }
  if (engineType === 'LANGUAGE') {
    return `ENGINE: LANGUAGE - productive language assessment (writing). Every question is an extended writing task graded by band descriptors, not by a single correct answer. Omit "options" and "correctAnswer"; "explanation" may describe what an exemplary response would do.`;
  }
  return `ENGINE: RUBRIC_ESSAY - examiner-graded extended response. Every question is graded against a banded rubric, not by a single correct answer. Omit "options" and "correctAnswer"; "explanation" may summarise the model answer expectations.`;
}

function brevityInstruction(input: GenerateExamRequest): string {
  const base = `OUTPUT LENGTH LIMIT (strict):
- Keep the entire JSON response compact enough to fit ~${BRIEF_TOKEN_LIMIT} tokens.
- "explanation" must be 1-2 sentences maximum. Do not write paragraphs.`;

  if (input.engineType === 'OBJECTIVE') {
    return `${base}
- Each stimulus passage (if any) must be at most 60 words.
- Option text must be short phrases, not full paragraphs.
- Do not repeat the passage inside the explanation.`;
  }

  return `${base}
- Rubric descriptor strings must be one line each, not full mark-scheme essays.`;
}

function buildPrompt(input: GenerateExamRequest): string {
  const contextBlock = input.promptContext
    ? `SOURCE MATERIAL (the teacher's notes; base the questions strictly on this content):
"""
${input.promptContext}
"""`
    : `SOURCE MATERIAL: none supplied. Generate curriculum-authentic questions for the subject "${input.subject}".`;

  const satBalancedBlock =
    input.curriculum === 'SAT' && input.engineType === 'OBJECTIVE'
      ? `
SAT BALANCE (mandatory when question count is 10):
- Use exactly half Reading & Writing style items and half Math items (${Math.floor((input.questionCount ?? 10) / 2)} R&W + ${Math.ceil((input.questionCount ?? 10) / 2)} Math for odd totals).
- Label each question's topic in the prompt first line, e.g. "[R&W] ..." or "[Math] ...".
`
      : '';

  return `You are a Principal Examiner and assessment designer for international examinations (IELTS, Cambridge Assessment International Education, College Board SAT).

TASK: Write a complete, exam-ready assessment.

SUBJECT: ${input.subject}
CURRICULUM: ${input.curriculum}
ENGINE TYPE: ${input.engineType}
NUMBER OF QUESTIONS: exactly ${input.questionCount}

${satBalancedBlock}

${curriculumBlueprint(input.curriculum, input.engineType)}

${engineBluePrint(input.engineType)}

${contextBlock}

${brevityInstruction(input)}

HARD RULES:
1. Return ONLY a single valid JSON object. No markdown, no code fences, no commentary.
2. The JSON object must match this exact schema:
{
  "curriculum": "${input.curriculum}",
  "subject": "${input.subject}",
  "title": "string - exam title in Turkish or English, e.g. 'CAIE Psychology 9990 - Paper 2 Practice'",
  "engineType": "${input.engineType}",
  "durationMinutes": number,
  "totalMarks": number,
  "questions": [
    {
      "id": "string - stable slug, e.g. 'q1'",
      "questionNumber": number,
      "prompt": "string - the full question text exactly as a candidate would read it",
      "type": "multiple_choice" | "extended_essay" | "structured_text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "string - for OBJECTIVE questions the single correct option letter (A|B|C|D); for other engines a brief model answer",
      "explanation": "string - why the correct answer is correct and why the main distractor is wrong",
      "targetMarks": number,
      "rubricCriteria": {
        "ao1_knowledge": "string",
        "ao2_application": "string",
        "ao3_evaluation": "string",
        "ielts_task_achievement": "string",
        "ielts_coherence_cohesion": "string",
        "ielts_lexical_resource": "string",
        "ielts_grammatical_range": "string"
      }
    }
  ]
}
3. Include only the rubric criteria keys that your curriculum requires. Omit the rest entirely.
4. "options" must be present only for "multiple_choice" questions and must contain exactly 4 entries. Omit it for essay and structured questions.
5. When "type" is "multiple_choice", both "correctAnswer" (option letter) and "explanation" are mandatory and must not be empty.
6. "correctAnswer" must never restate the option text; for multiple choice it is the bare letter only.
7. "totalMarks" must equal the exact sum of every question's "targetMarks".
8. "durationMinutes" must be realistic for the mark total: about 1 minute per mark, minimum 10 minutes.
9. Return exactly ${input.questionCount} question(s) - no more, no fewer.
10. Questions must be original, unambiguous, exam-accurate and free of duplicated content. Question text in English; the "title" may be Turkish.
11. Do not add any field that is not in the schema above.`;
}

/**
 * Markdown ```json ... ``` çitlerini kaldırır.
 */
function stripMarkdownCodeFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^\s*```(?:json)?\s*\r?\n?/im, '');
  t = t.replace(/\r?\n?\s*```\s*$/im, '');
  return t.trim();
}

/**
 * Model metninden dengeli süslü parantezle tek JSON nesnesi ayıklar (iç içe objeler için lastIndexOf yerine).
 * `responseMimeType: application/json` bazen yine de kaçışlı/markdown içerik dönebilir.
 */
export function extractJsonFromModelText(raw: string): JsonRecord {
  const cleaned = stripMarkdownCodeFences(raw);
  const start = cleaned.indexOf('{');
  if (start === -1) {
    throw new ModelOutputError(
      'Model yanıtı geçerli bir JSON nesnesi içermiyor (açılış süslü parantez yok).',
    );
  }

  let depth = 0;
  let end = -1;
  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new ModelOutputError(
      'Model yanıtı geçerli bir JSON nesnesi içermiyor (süslü parantez dengesi bozuk veya yanıt kesik).',
    );
  }

  const slice = cleaned.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch (error) {
    console.error(
      '[generate-exam] JSON.parse başarısız:',
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      '[generate-exam] Ham parça (ilk 1200 karakter):',
      slice.slice(0, 1200),
    );
    throw new ModelOutputError('Model yanıtındaki JSON ayrıştırılamadı.');
  }

  if (!isRecord(parsed)) {
    throw new ModelOutputError(
      'Model yanıtı beklenen JSON nesnesi biçiminde değil.',
    );
  }
  return parsed;
}

function extractJsonObject(text: string): JsonRecord {
  return extractJsonFromModelText(text);
}

function isJsonShapeRetryable(error: unknown): boolean {
  if (error instanceof QuestionCountMismatchError) return false;
  if (!(error instanceof ModelOutputError)) return false;
  const m = error.message;
  return (
    m.includes('JSON') ||
    m.includes('json') ||
    m.includes('süslü parantez') ||
    m.includes('ayrıştırılamadı') ||
    m.includes('içermiyor')
  );
}

function computeMaxOutputTokens(input: GenerateExamRequest): number {
  const count = input.questionCount ?? DEFAULT_QUESTION_COUNT;
  if (input.engineType === 'OBJECTIVE' && count >= 8) {
    return Math.min(
      MAX_OUTPUT_TOKENS_CAP,
      Math.max(MAX_OUTPUT_TOKENS, 900 + count * 320),
    );
  }
  return MAX_OUTPUT_TOKENS;
}

/**
 * Model "A", "a", "A)" gibi varyantlar döndürebilir; hepsini tek harfe indirger.
 * Şık metnini döndürürse (ör. "A) Paris") bunu şema ihlali sayar.
 */
function normalizeCorrectAnswer(
  raw: unknown,
  options: string[],
  index: number,
): string | undefined {
  const value = optionalString(raw);
  if (!value) return undefined;

  // "A)", "a", "A .", "Option A" -> "A"
  const matched = value
    .toUpperCase()
    .match(/^(?:OPTION\s*)?([A-D])(?![A-Z0-9])/);

  const letter = matched?.[1];
  if (!letter) {
    throw new ModelOutputError(
      `Soru ${index + 1}: "correctAnswer" A-D arası bir şık harfi olmalıdır, alınan değer: "${value.slice(0, 60)}".`,
    );
  }

  // Harfe karşılık gelen şık gerçekten var mı?
  // Model "A)", "A.", "A:", "A -" gibi farklı etiketleme kullanabilir; hepsini kabul et.
  const optionLabelPattern = new RegExp(`^\\s*(?:OPTION\\s*)?${letter}\\s*[).:\\-]`, 'i');
  const hasOption = options.some((option) => optionLabelPattern.test(option));

  if (options.length > 0 && !hasOption) {
    throw new ModelOutputError(
      `Soru ${index + 1}: "correctAnswer" "${letter}" şıkkını işaret ediyor ama şıklar arasında "${letter}" etiketli bir seçenek yok.`,
    );
  }

  return letter;
}

function normalizeQuestion(
  raw: unknown,
  index: number,
  engineType: EngineType,
): ExamQuestion {
  if (!isRecord(raw)) {
    throw new ModelOutputError(`Soru ${index + 1} geçerli bir nesne değil.`);
  }

  const questionNumber =
    typeof raw.questionNumber === 'number' && Number.isFinite(raw.questionNumber)
      ? Math.trunc(raw.questionNumber)
      : index + 1;

  const targetMarksRaw = raw.targetMarks;
  const targetMarks =
    typeof targetMarksRaw === 'number' &&
    Number.isFinite(targetMarksRaw) &&
    targetMarksRaw > 0
      ? targetMarksRaw
      : 1;

  const rawType = raw.type;
  const type =
    rawType === 'multiple_choice' ||
    rawType === 'extended_essay' ||
    rawType === 'structured_text'
      ? rawType
      : 'extended_essay';

  const options = Array.isArray(raw.options)
    ? raw.options.filter((option): option is string => typeof option === 'string')
    : [];

  const correctAnswer = normalizeCorrectAnswer(raw.correctAnswer, options, index);
  const explanation = optionalString(raw.explanation);
  const isObjective = engineType === 'OBJECTIVE';

  if (isObjective && type !== 'multiple_choice') {
    throw new ModelOutputError(
      `Soru ${index + 1}: OBJECTIVE motoru yalnızca "multiple_choice" soru kabul eder, model "${type}" döndürdü.`,
    );
  }

  if (type === 'multiple_choice') {
    if (options.length !== OBJECTIVE_OPTION_COUNT) {
      throw new ModelOutputError(
        `Soru ${index + 1}: "multiple_choice" sorusu tam olarak ${OBJECTIVE_OPTION_COUNT} şık içermelidir, ${options.length} bulundu.`,
      );
    }
    if (!correctAnswer) {
      throw new ModelOutputError(
        `Soru ${index + 1}: "correctAnswer" zorunludur ve A-D arası bir şık harfi olmalıdır.`,
      );
    }
    if (!explanation) {
      throw new ModelOutputError(
        `Soru ${index + 1}: "explanation" zorunludur, model boş bıraktı.`,
      );
    }
  }

  const rubricRaw = isRecord(raw.rubricCriteria) ? raw.rubricCriteria : {};
  const rubricCriteria = {
    ...(optionalString(rubricRaw.ao1_knowledge)
      ? { ao1_knowledge: optionalString(rubricRaw.ao1_knowledge) }
      : {}),
    ...(optionalString(rubricRaw.ao2_application)
      ? { ao2_application: optionalString(rubricRaw.ao2_application) }
      : {}),
    ...(optionalString(rubricRaw.ao3_evaluation)
      ? { ao3_evaluation: optionalString(rubricRaw.ao3_evaluation) }
      : {}),
    ...(optionalString(rubricRaw.ielts_task_achievement)
      ? { ielts_task_achievement: optionalString(rubricRaw.ielts_task_achievement) }
      : {}),
    ...(optionalString(rubricRaw.ielts_coherence_cohesion)
      ? {
          ielts_coherence_cohesion: optionalString(
            rubricRaw.ielts_coherence_cohesion,
          ),
        }
      : {}),
    ...(optionalString(rubricRaw.ielts_lexical_resource)
      ? { ielts_lexical_resource: optionalString(rubricRaw.ielts_lexical_resource) }
      : {}),
    ...(optionalString(rubricRaw.ielts_grammatical_range)
      ? {
          ielts_grammatical_range: optionalString(
            rubricRaw.ielts_grammatical_range,
          ),
        }
      : {}),
  };

  return {
    id: optionalString(raw.id) ?? `q${index + 1}`,
    questionNumber,
    prompt: requireModelString(raw.prompt, `questions[${index}].prompt`),
    type,
    ...(type === 'multiple_choice' && options.length > 0 ? { options } : {}),
    ...(correctAnswer ? { correctAnswer } : {}),
    ...(explanation ? { explanation } : {}),
    targetMarks,
    ...(Object.keys(rubricCriteria).length > 0 ? { rubricCriteria } : {}),
  };
}

function normalizePayload(
  raw: JsonRecord,
  input: GenerateExamRequest,
): AssessmentPayload {
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    throw new ModelOutputError('Model yanıtında hiç soru üretilmedi.');
  }

  const questions = raw.questions.map((question, index) =>
    normalizeQuestion(question, index, input.engineType),
  );

  if (questions.length !== input.questionCount) {
    throw new QuestionCountMismatchError(
      `Model ${input.questionCount} soru istenmesine rağmen ${questions.length} soru üretti.`,
    );
  }

  const totalMarks = questions.reduce(
    (sum, question) => sum + question.targetMarks,
    0,
  );

  const rawDuration = raw.durationMinutes;
  const durationMinutes =
    typeof rawDuration === 'number' &&
    Number.isFinite(rawDuration) &&
    rawDuration > 0
      ? Math.trunc(rawDuration)
      : Math.max(10, totalMarks);

  return {
    curriculum: input.curriculum,
    subject: input.subject,
    title: optionalString(raw.title) ?? `${input.subject} - ${input.curriculum}`,
    engineType: input.engineType,
    durationMinutes,
    totalMarks,
    questions,
  };
}

/**
 * Tek bir üretim denemesi. Sadece soru sayısı tutmadığında
 * `QuestionCountMismatchError` fırlatır; diğer tüm hatalar olduğu gibi yukarı çıkar.
 *
 * `timeoutMs` çağıran tarafından bütçeye göre belirlenir; böylece platformun
 * 60 sn sınırına hiçbir koşulda çarpılmaz.
 */
async function generateOnce(
  ai: GoogleGenAI,
  input: GenerateExamRequest,
  timeoutMs: number,
): Promise<AssessmentPayload> {
  const maxOutputTokens = computeMaxOutputTokens(input);
  let lastRecoverableError: ModelOutputError | undefined;

  for (let apiAttempt = 0; apiAttempt < 2; apiAttempt += 1) {
    const attemptTimeout =
      apiAttempt === 0
        ? timeoutMs
        : Math.max(MIN_ATTEMPT_WINDOW_MS, Math.floor(timeoutMs * 0.55));

    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    const contents = buildPrompt(input);

    try {
      response = await generateContentWithPrimaryThenFallback(ai, {
        contents,
        maxOutputTokens,
        attemptTimeout,
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
      const emptyErr = new ModelOutputError('Model boş yanıt döndürdü.');
      if (apiAttempt === 0) {
        lastRecoverableError = emptyErr;
        console.warn('[generate-exam] Boş yanıt, tek seferlik yeniden üretim.');
        continue;
      }
      throw emptyErr;
    }

    try {
      return normalizePayload(extractJsonFromModelText(text), input);
    } catch (error) {
      if (
        apiAttempt === 0 &&
        isJsonShapeRetryable(error)
      ) {
        lastRecoverableError =
          error instanceof ModelOutputError
            ? error
            : new ModelOutputError(String(error));
        console.warn(
          '[generate-exam] Model JSON/şema hatası, tek seferlik yeniden üretim:',
          lastRecoverableError.message,
        );
        continue;
      }
      throw error;
    }
  }

  throw (
    lastRecoverableError ??
    new ModelOutputError('Model çıktısı işlenemedi (yeniden deneme tükendi).')
  );
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
async function generateWithRetry(
  ai: GoogleGenAI,
  input: GenerateExamRequest,
): Promise<AssessmentPayload> {
  const deadline = Date.now() + MAX_RETRY_BUDGET_MS;
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
    const isLastAttempt = attempt === MAX_TRANSIENT_RETRIES;
    const timeoutMs = Math.min(CALL_TIMEOUT_MS, deadline - Date.now());

    if (timeoutMs < MIN_ATTEMPT_WINDOW_MS) {
      console.warn(
        `[generate-exam] Kalan bütçe yetersiz ` +
          `(${Math.max(0, Math.round(timeoutMs / 1000))} sn), yeni deneme başlatılmayacak.`,
      );
      break;
    }

    console.info(
      `[generate-exam] Deneme ${attempt + 1}/${MAX_TRANSIENT_RETRIES + 1} ` +
        `(model: ${MODEL_LINE_FOR_LOG}, timeout: ${Math.round(timeoutMs / 1000)} sn)`,
    );

    try {
      return await generateOnce(ai, input, timeoutMs);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;

      lastError = error;

      // 403 kalıcıdır. 429/503 için generateOnce içinde yedek modele düşüldükten sonra
      // hâlâ ProviderError geliyorsa üst katman retry (generateWithRetry) veya son hata.
      if (error.statusCode === 403) {
        console.warn(
          `[generate-exam] Kalıcı hata (HTTP ${error.statusCode}), retry yapılmayacak:`,
          error.providerMessage ?? error.message,
        );
        throw error;
      }

      if (isLastAttempt) break;

      // Gecikmeden sonra kalan süre anlamlı bir deneme için yetmiyorsa hiç başlatma.
      const afterDelay = deadline - Date.now() - RETRY_DELAY_MS;
      if (afterDelay < MIN_ATTEMPT_WINDOW_MS) {
        console.warn(
          '[generate-exam] Retry için yeterli bütçe kalmadı, durduruluyor:',
          error.message,
        );
        break;
      }

      console.warn(
        `[generate-exam] Geçici hata, ${RETRY_DELAY_MS} ms sonra tekrar denenecek:`,
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

/**
 * Sınav motorunun çekirdek girişi — HTTP rotası ve sunucu aksiyonları aynı yolu kullanır.
 */
export async function runGenerateExam(
  input: GenerateExamRequest,
): Promise<AssessmentPayload> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ProviderError(
      'GEMINI_API_KEY ortam değişkeni tanımlı değil. Sunucu yapılandırmasını kontrol edin.',
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    return await generateWithRetry(ai, input);
  } catch (error) {
    if (!(error instanceof QuestionCountMismatchError)) {
      throw error;
    }

    console.warn(
      '[generate-exam] Soru sayısı uyuşmadı, 1 kez yeniden denenecek:',
      error.message,
    );
    return await generateWithRetry(ai, input);
  }
}

export async function POST(request: NextRequest) {
  let input: GenerateExamRequest;

  try {
    const body: unknown = await request.json();
    input = parseRequestBody(body);
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? 'İstek gövdesi geçerli bir JSON değil.'
        : error instanceof Error
          ? error.message
          : 'İstek doğrulanamadı.';
    return errorResponse(message, 400);
  }

  try {
    const exam = await runGenerateExam(input);

    return NextResponse.json({ success: true, exam });
  } catch (error) {
    if (error instanceof ProviderError) {
      console.error(
        '[generate-exam] Sağlayıcı hatası.',
        {
          model: MODEL_LINE_FOR_LOG,
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
        'Sınav motoru şu anda yoğun; birkaç saniye sonra tekrar dene.',
        503,
      );
    }

    if (error instanceof QuestionCountMismatchError) {
      console.error('[generate-exam] Retry sonrası soru sayısı hâlâ uyuşmuyor.', {
        model: MODEL_LINE_FOR_LOG,
        message: error.message,
      });
      return errorResponse(
        `Model istenen sayıda soru üretemedi (yeniden deneme dahil): ${error.message}`,
        502,
      );
    }

    if (error instanceof ModelOutputError) {
      console.error('[generate-exam] Model şema ihlali.', {
        model: MODEL_LINE_FOR_LOG,
        message: error.message,
      });
      return errorResponse(
        `Model beklenen sınav şemasına uymayan bir yanıt üretti: ${error.message}`,
        502,
      );
    }

    console.error('[generate-exam] Sınav üretimi başarısız.', {
      model: MODEL_LINE_FOR_LOG,
      statusCode: errorStatusOf(error) ?? 'yok',
      errorName: error instanceof Error ? error.name : typeof error,
      message: errorMessageOf(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(
      'Sınav üretilirken beklenmeyen bir hata oluştu.',
      500,
    );
  }
}
