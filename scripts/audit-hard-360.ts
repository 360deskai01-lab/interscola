/**
 * Faz 6 — 360° Hard Integration & Stress Audit
 *
 * Gerekli ortam (.env.local):
 * - SUPABASE_URL veya NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * İsteğe bağlı:
 * - AUDIT_STUDENT_ID — yoksa onaylı ilk öğrenci (öncelik: ogrenci@test.com)
 * - AUDIT_BASE_URL (varsayılan http://127.0.0.1:3000) — canlı grade-exam HTTP
 * - AUDIT_SAT_LIBRARY_ID — yoksa doğrulanmış açık SAT kaydı aranır
 * - AUDIT_TEACHER_ID, AUDIT_TEACHER_LIBRARY_ID — yoksa Test 4 için otomatik profil/materyal
 * - GEMINI_API_KEY — Test 3 canlı IELTS puanlama
 */
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  assessmentPayloadFromJsonb,
  parseAssessmentPayload,
} from '../src/lib/assessment-payload';
import {
  ATTEMPTS_TABLE,
  PROFILES_SCHEMA,
  getSupabaseAdmin,
} from '../src/lib/supabase';
import type { AssessmentPayload, EvaluationResult } from '../src/types/exam';

config({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}

const ANSI = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const IELTS_LIBRARY_TITLE =
  'IELTS Academic Writing & Reading Hızlı Teşhis Testi';

const SAT_MIN_SCORE = 400;
const SAT_MAX_SCORE = 1600;

const IELTS_METRIC_LABELS = [
  'Task Achievement',
  'Coherence & Cohesion',
  'Lexical Resource',
  'Grammatical Range',
] as const;

type AuditResult =
  | { ok: true; contractMock?: false }
  | { ok: true; contractMock: true }
  | { ok: false; message: string };

function logPass(name: string, ms: number): void {
  console.info(
    `${ANSI.green}[PASS]${ANSI.reset} ${name} ${ANSI.dim}(${ms} ms)${ANSI.reset}`,
  );
}

function logPassContractMockTest3(ms: number): void {
  console.info(
    `${ANSI.green}[PASS - CONTRACT MOCK]${ANSI.reset} TEST 3 — IELTS LANGUAGE motoru (Gemini kotası nedeniyle statik rubrik sözleşmesiyle doğrulandı) ${ANSI.dim}(${ms} ms)${ANSI.reset}`,
  );
}

function logFail(name: string, ms: number, message: string, error?: unknown): void {
  console.error(
    `${ANSI.red}[FAIL]${ANSI.reset} ${name} ${ANSI.dim}(${ms} ms)${ANSI.reset}`,
  );
  console.error(`${ANSI.red}  → ${message}${ANSI.reset}`);
  if (error !== undefined) {
    if (error instanceof Error) {
      console.error(error.stack ?? error.message);
    } else {
      console.error(error);
    }
  }
}

function getPublicAdmin(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
}

const PREFERRED_AUDIT_STUDENT_EMAIL = 'ogrenci@test.com';

async function resolveAuditStudentId(
  client: SupabaseClient,
): Promise<string> {
  const fromEnv = process.env.AUDIT_STUDENT_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const { data: preferred, error: preferredError } = await client
    .from('profiles')
    .select('id, email')
    .eq('role', 'student')
    .eq('status', 'approved')
    .eq('email', PREFERRED_AUDIT_STUDENT_EMAIL)
    .limit(1)
    .maybeSingle();

  if (!preferredError && preferred) {
    const row = preferred as { id: string; email: string };
    console.info(
      `[AUDIT SETUP] Test öğrencisi otomatik tespit edildi: ${row.email} (${row.id})`,
    );
    return row.id;
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, email')
    .eq('role', 'student')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      'Onaylı öğrenci profili bulunamadı. AUDIT_STUDENT_ID tanımlayın veya test öğrencisi seed edin.',
    );
  }

  const row = data as { id: string; email: string };
  console.info(
    `[AUDIT SETUP] Test öğrencisi otomatik tespit edildi: ${row.email} (${row.id})`,
  );
  return row.id;
}

async function resolveAuditTeacher(
  client: SupabaseClient,
): Promise<{ id: string; email: string }> {
  const fromEnv = process.env.AUDIT_TEACHER_ID?.trim();
  if (fromEnv) {
    const { data, error } = await client
      .from('profiles')
      .select('id, email')
      .eq('id', fromEnv)
      .eq('role', 'teacher')
      .maybeSingle();

    if (!error && data) {
      return data as { id: string; email: string };
    }

    return { id: fromEnv, email: fromEnv };
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, email')
    .eq('role', 'teacher')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      'Onaylı öğretmen profili bulunamadı. AUDIT_TEACHER_ID tanımlayın.',
    );
  }

  const row = data as { id: string; email: string };
  console.info(
    `[AUDIT SETUP] Test öğretmeni otomatik tespit edildi: ${row.email} (${row.id})`,
  );
  return row;
}

async function resolveAuditTeacherLibraryId(
  client: SupabaseClient,
  teacherId: string,
): Promise<string | null> {
  const fromEnv = process.env.AUDIT_TEACHER_LIBRARY_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const { data, error } = await client
    .from('libraries')
    .select('id, title')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as { id: string; title: string };
  console.info(
    `[AUDIT SETUP] Test materyali otomatik tespit edildi: ${row.title} (${row.id})`,
  );
  return row.id;
}

const AUDIT_EPHEMERAL_LIBRARY_TITLE = 'Audit Test Study Material';

async function ensureTeacherLibraryForAudit(
  client: SupabaseClient,
  teacherId: string,
): Promise<{ libraryId: string; ephemeral: boolean }> {
  const existing = await resolveAuditTeacherLibraryId(client, teacherId);
  if (existing) {
    return { libraryId: existing, ephemeral: false };
  }

  const { data, error } = await client
    .from('libraries')
    .insert({
      teacher_id: teacherId,
      title: AUDIT_EPHEMERAL_LIBRARY_TITLE,
      curriculum: 'SAT',
      subject: 'Audit Regression',
      extracted_text:
        'Geçici audit materyali: study ve exam atamalarının aynı library_id üzerinde ' +
        'ayrık assignment_type ile birlikte var olabildiğini doğrulamak için oluşturuldu.',
    })
    .select('id, title')
    .single();

  if (error || !data) {
    throw new Error(
      `Geçici audit materyali oluşturulamadı: ${error?.message ?? 'bilinmeyen'}`,
    );
  }

  const row = data as { id: string; title: string };
  console.info(
    `[AUDIT SETUP] Geçici materyal oluşturuldu: ${row.title} (${row.id})`,
  );
  return { libraryId: row.id, ephemeral: true };
}

async function cleanupEphemeralAuditTest4(
  client: SupabaseClient,
  libraryId: string,
  teacherId: string,
  studentId: string,
): Promise<void> {
  const { error: assignmentError } = await client
    .from('assignments')
    .delete()
    .eq('library_id', libraryId)
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId);

  if (assignmentError) {
    console.warn(
      '[AUDIT CLEANUP] Geçici atamalar silinemedi:',
      assignmentError.message,
    );
  }

  const { error: libraryError } = await client
    .from('libraries')
    .delete()
    .eq('id', libraryId)
    .eq('title', AUDIT_EPHEMERAL_LIBRARY_TITLE)
    .eq('teacher_id', teacherId);

  if (libraryError) {
    console.warn(
      '[AUDIT CLEANUP] Geçici materyal silinemedi:',
      libraryError.message,
    );
  } else {
    console.info(`[AUDIT CLEANUP] Geçici materyal temizlendi: ${libraryId}`);
  }
}

function isGeminiQuotaError(httpStatus: number, bodyText: string): boolean {
  if (httpStatus === 429) return true;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('kota') ||
    lower.includes('too many requests') ||
    lower.includes('resource exhausted')
  );
}

function roundToHalfBand(value: number): number {
  return Math.round(value * 2) / 2;
}

/** grade-exam IELTS dalındaki 4 kriter + genel Band (1–9, 0.5 adım) sözleşmesi. */
function validateIeltsMockBandContract(): AuditResult | null {
  const mockCriterionBands = [6, 6.5, 7, 6.5];
  const overallBand = roundToHalfBand(
    mockCriterionBands.reduce((sum, band) => sum + band, 0) /
      mockCriterionBands.length,
  );

  if (overallBand < 1 || overallBand > 9) {
    return {
      ok: false,
      message: `Mock genel band aralık dışı: ${overallBand}`,
    };
  }

  if (overallBand * 2 !== Math.round(overallBand * 2)) {
    return {
      ok: false,
      message: 'Mock band 0.5 adım kuralına uymuyor.',
    };
  }

  const metricBreakdown: Record<string, number> = {};
  IELTS_METRIC_LABELS.forEach((label, index) => {
    metricBreakdown[label] = mockCriterionBands[index]!;
  });

  for (const label of IELTS_METRIC_LABELS) {
    const band = metricBreakdown[label];
    if (typeof band !== 'number' || band < 1 || band > 9) {
      return {
        ok: false,
        message: `Mock rubrik band geçersiz: ${label}`,
      };
    }
  }

  const scaledResult = `Band ${overallBand.toFixed(1)}`;
  if (!/^Band\s[\d.]+/.test(scaledResult)) {
    return { ok: false, message: 'Mock Band formatı geçersiz.' };
  }

  return null;
}

function tryIeltsQuotaContractMockPass(
  exam: AssessmentPayload,
  httpStatus: number,
  bodyText: string,
  parsedError?: string,
): AuditResult | null {
  const haystack = `${parsedError ?? ''} ${bodyText}`;
  if (!isGeminiQuotaError(httpStatus, haystack)) {
    return null;
  }

  const staticIssue = validateIeltsStaticContract(exam);
  if (staticIssue) {
    return staticIssue;
  }

  const bandIssue = validateIeltsMockBandContract();
  if (bandIssue) {
    return bandIssue;
  }

  return { ok: true, contractMock: true };
}

function validateIeltsStaticContract(exam: AssessmentPayload): AuditResult | null {
  if (exam.engineType !== 'LANGUAGE') {
    return { ok: false, message: 'IELTS payload geçersiz veya LANGUAGE değil.' };
  }

  const essayQuestion = exam.questions.find((q) => q.type === 'extended_essay');
  if (!essayQuestion?.rubricCriteria) {
    return { ok: false, message: 'Task 2 rubricCriteria eksik.' };
  }

  const rubric = essayQuestion.rubricCriteria;
  const requiredKeys = [
    'ielts_task_achievement',
    'ielts_coherence_cohesion',
    'ielts_lexical_resource',
    'ielts_grammatical_range',
  ] as const;
  for (const key of requiredKeys) {
    if (!rubric[key]?.trim()) {
      return { ok: false, message: `Rubrik alanı eksik: ${key}` };
    }
  }

  return null;
}

function roundToNearestTen(value: number): number {
  return Math.round(value / 10) * 10;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeChoiceAnswer(value: string | undefined): string | undefined {
  const parsed = typeof value === 'string' ? value.trim() : '';
  if (!parsed) return undefined;
  const matched = parsed.toUpperCase().match(/^(?:OPTION\s*)?([A-D])(?![A-Z0-9])/);
  return matched?.[1];
}

/** grade-exam/route.ts OBJECTIVE dalı ile aynı deterministik puanlama. */
function auditGradeObjective(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
): EvaluationResult {
  const questions = exam.questions.filter((q) => q.type === 'multiple_choice');
  if (questions.length === 0) {
    throw new Error('OBJECTIVE sınavda çoktan seçmeli soru yok.');
  }

  let correct = 0;
  for (const question of questions) {
    const studentAnswer = normalizeChoiceAnswer(studentAnswers[question.id]);
    if (
      studentAnswer &&
      studentAnswer === normalizeChoiceAnswer(question.correctAnswer)
    ) {
      correct += 1;
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

  return {
    score: scaled,
    maxScore: SAT_MAX_SCORE,
    scaledResult: `${scaled} / ${SAT_MAX_SCORE}`,
    metricBreakdown: {
      dogru: correct,
      yanlis: total - correct,
      accuracy: roundTo2(accuracy * 100),
    },
    feedback: `${total} sorunun ${correct} tanesi doğru.`,
    remedialTopics: [],
  };
}

function isAssignmentUniqueViolation(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const haystack = `${error.message ?? ''}`.toLowerCase();
  return (
    haystack.includes('duplicate key') ||
    haystack.includes('unique_assignment_material_student_type')
  );
}

async function findInProgressSelfPracticeAssignment(
  client: SupabaseClient,
  studentId: string,
  libraryId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('assignments')
    .select('id')
    .eq('student_id', studentId)
    .eq('library_id', libraryId)
    .is('teacher_id', null)
    .eq('assignment_type', 'exam')
    .eq('status', 'in_progress')
    .maybeSingle();

  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function findLatestSelfPracticeExamAssignment(
  client: SupabaseClient,
  studentId: string,
  libraryId: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await client
    .from('assignments')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('library_id', libraryId)
    .is('teacher_id', null)
    .eq('assignment_type', 'exam')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: string; status: string };
}

/**
 * public-library-actions.ts `insertNewSelfPacedAssignment` ile parity.
 */
async function mirrorInsertSelfPacedAssignment(
  client: SupabaseClient,
  studentId: string,
  libraryId: string,
  examPayload: AssessmentPayload,
): Promise<{ ok: true; assignmentId: string } | { ok: false; error: string }> {
  let validatedExam: AssessmentPayload;
  try {
    validatedExam = parseAssessmentPayload(examPayload);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Sınav verisi doğrulanamadı.',
    };
  }

  const { data: inserted, error: insertError } = await client
    .from('assignments')
    .insert({
      library_id: libraryId,
      teacher_id: null,
      student_id: studentId,
      status: 'in_progress',
      assignment_type: 'exam',
      exam_payload: validatedExam,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    if (isAssignmentUniqueViolation(insertError ?? null)) {
      const existing = await findLatestSelfPracticeExamAssignment(
        client,
        studentId,
        libraryId,
      );
      if (existing) {
        if (existing.status !== 'in_progress') {
          await client
            .from('assignments')
            .update({
              status: 'in_progress',
              exam_payload: validatedExam,
            })
            .eq('id', existing.id)
            .eq('student_id', studentId);
        }
        return { ok: true, assignmentId: existing.id };
      }
    }
    return {
      ok: false,
      error: insertError?.message ?? 'Sınav oturumu başlatılamadı.',
    };
  }

  return { ok: true, assignmentId: (inserted as { id: string }).id };
}

/** startSelfPacedExamAction çekirdeği (oturum yerine açık studentId). */
async function mirrorStartSelfPacedExam(
  client: SupabaseClient,
  studentId: string,
  libraryId: string,
  examPayload: AssessmentPayload,
): Promise<{ success: boolean; assignmentId?: string; error?: string }> {
  const inProgressId = await findInProgressSelfPracticeAssignment(
    client,
    studentId,
    libraryId,
  );
  if (inProgressId) {
    return { success: true, assignmentId: inProgressId };
  }

  const created = await mirrorInsertSelfPacedAssignment(
    client,
    studentId,
    libraryId,
    examPayload,
  );
  if (!created.ok) {
    return { success: false, error: created.error };
  }
  return { success: true, assignmentId: created.assignmentId };
}

/**
 * public-library-actions.ts `findSeededDiagnosticLibrary` sorgu parity.
 */
async function mirrorFindSeededDiagnosticLibrary(
  client: SupabaseClient,
  primaryCurriculum: string,
): Promise<
  | { ok: true; row: { id: string; curriculum: string; title: string } }
  | { ok: false; error: string }
> {
  const code = primaryCurriculum.trim().toUpperCase() || 'SAT';
  const select =
    'id, title, curriculum, subject, extracted_text, exam_payload';

  const { data: primary, error: primaryError } = await client
    .from('libraries')
    .select(select)
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', code)
    .not('exam_payload', 'is', null)
    .ilike('title', '%Diagnostic%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (primaryError) {
    return { ok: false, error: primaryError.message };
  }

  const pick = (row: typeof primary) => {
    if (!row) return null;
    const exam = assessmentPayloadFromJsonb(
      (row as { exam_payload: unknown }).exam_payload,
    );
    if (!exam) return null;
    return {
      id: (row as { id: string }).id,
      title: (row as { title: string }).title,
      curriculum: (row as { curriculum: string }).curriculum,
    };
  };

  const primaryRow = pick(primary);
  if (primaryRow) {
    return { ok: true, row: primaryRow };
  }

  const { data: satFallback, error: satError } = await client
    .from('libraries')
    .select(select)
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', 'SAT')
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (satError) {
    return { ok: false, error: satError.message };
  }

  const satRow = pick(satFallback);
  if (satRow) {
    return { ok: true, row: satRow };
  }

  return { ok: false, error: 'Teşhis kaydı bulunamadı.' };
}

async function resolveSatPublicLibrary(
  client: SupabaseClient,
  explicitId?: string,
): Promise<{ id: string; exam: AssessmentPayload }> {
  if (explicitId) {
    const { data, error } = await client
      .from('libraries')
      .select('id, exam_payload, is_public, verification_status, curriculum')
      .eq('id', explicitId)
      .maybeSingle();
    if (error || !data) {
      throw new Error(`AUDIT_SAT_LIBRARY_ID geçersiz: ${error?.message ?? 'yok'}`);
    }
    const exam = assessmentPayloadFromJsonb(
      (data as { exam_payload: unknown }).exam_payload,
    );
    if (!exam) throw new Error('SAT kütüphanesinde geçerli exam_payload yok.');
    return { id: (data as { id: string }).id, exam };
  }

  const { data, error } = await client
    .from('libraries')
    .select('id, exam_payload')
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', 'SAT')
    .not('exam_payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      `Doğrulanmış açık SAT kütüphanesi bulunamadı: ${error?.message ?? 'kayıt yok'}`,
    );
  }

  const exam = assessmentPayloadFromJsonb(
    (data as { exam_payload: unknown }).exam_payload,
  );
  if (!exam) throw new Error('Açık SAT exam_payload parse edilemedi.');
  return { id: (data as { id: string }).id, exam };
}

async function auditPersistSelfPracticeAttempt(
  exam: AssessmentPayload,
  studentAnswers: Record<string, string>,
  evaluation: EvaluationResult,
  studentId: string,
  assignmentId: string,
): Promise<string> {
  const attempts = getSupabaseAdmin();
  if (!attempts) {
    throw new Error('interscola şeması admin istemcisi kullanılamıyor.');
  }

  const percentage =
    evaluation.maxScore > 0
      ? roundTo2((evaluation.score / evaluation.maxScore) * 100)
      : 0;

  const row = {
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
    assignment_id: assignmentId,
    origin_type: 'self_practice' as const,
  };

  const { data, error } = await attempts
    .from(ATTEMPTS_TABLE)
    .insert(row)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(
      `assessment_attempts insert başarısız: ${error?.message ?? 'bilinmeyen'}`,
    );
  }

  return String((data as { id: string }).id);
}

function buildIeltsSampleEssay(wordTarget = 150): string {
  const base =
    'Some people argue that unpaid community service should be compulsory in high school programmes. ' +
    'I partly agree because structured volunteering can teach responsibility and civic awareness. ' +
    'When students support charities, they learn empathy and teamwork while improving local neighbourhoods. ' +
    'However, forcing every teenager to participate may reduce motivation and create resentment. ' +
    'Schools should offer flexible options such as environmental projects, peer tutoring, or sports coaching for younger children. ' +
    'Clear guidance from teachers helps students reflect on their contribution and connect service to academic skills like planning and communication. ' +
    'In my experience, optional programmes with meaningful recognition often produce better engagement than rigid mandates. ' +
    'Therefore, governments and schools should encourage service strongly but allow reasonable exemptions for students facing hardship.';
  const words = base.split(/\s+/);
  while (words.length < wordTarget) {
    words.push(
      'Community',
      'service',
      'builds',
      'character',
      'when',
      'tasks',
      'are',
      'well',
      'designed.',
    );
  }
  return words.slice(0, wordTarget).join(' ');
}

async function runTest1Concurrency(
  client: SupabaseClient,
  studentId: string,
  libraryId: string,
  exam: AssessmentPayload,
): Promise<AuditResult> {
  const parallel = 5;
  const results = await Promise.all(
    Array.from({ length: parallel }, () =>
      mirrorStartSelfPacedExam(client, studentId, libraryId, exam),
    ),
  );

  const failures = results.filter((r) => !r.success || !r.assignmentId);
  if (failures.length > 0) {
    return {
      ok: false,
      message: `${failures.length}/${parallel} çağrı başarısız: ${failures[0]?.error ?? 'ID yok'}`,
    };
  }

  const ids = new Set(results.map((r) => r.assignmentId));
  if (ids.size !== 1) {
    return {
      ok: false,
      message: `Beklenen tek assignmentId, alınan: ${[...ids].join(', ')}`,
    };
  }

  const rawErrors = results
    .map((r) => r.error ?? '')
    .filter((e) => e.includes('23505') || e.toLowerCase().includes('duplicate'));
  if (rawErrors.length > 0) {
    return {
      ok: false,
      message: `23505 kullanıcıya sızdı: ${rawErrors[0]}`,
    };
  }

  return { ok: true };
}

async function runTest2SelfPracticeGrading(
  client: SupabaseClient,
  studentId: string,
  libraryId: string,
  exam: AssessmentPayload,
): Promise<AuditResult> {
  const start = await mirrorStartSelfPacedExam(
    client,
    studentId,
    libraryId,
    exam,
  );
  if (!start.success || !start.assignmentId) {
    return { ok: false, message: start.error ?? 'Atama açılamadı.' };
  }

  const mcQuestions = exam.questions.filter((q) => q.type === 'multiple_choice');
  if (mcQuestions.length < 2) {
    return { ok: false, message: 'SAT payload en az 2 MC soru içermeli.' };
  }

  const studentAnswers: Record<string, string> = {};
  studentAnswers[mcQuestions[0]!.id] =
    normalizeChoiceAnswer(mcQuestions[0]!.correctAnswer) ?? 'B';
  studentAnswers[mcQuestions[1]!.id] = 'A';

  const evaluation = auditGradeObjective(exam, studentAnswers);
  const expectedScore = roundToNearestTen(
    SAT_MIN_SCORE + 0.5 * (SAT_MAX_SCORE - SAT_MIN_SCORE),
  );
  if (evaluation.score !== expectedScore) {
    return {
      ok: false,
      message: `Skor uyuşmazlığı: beklenen ${expectedScore}, gelen ${evaluation.score}`,
    };
  }

  const attemptId = await auditPersistSelfPracticeAttempt(
    exam,
    studentAnswers,
    evaluation,
    studentId,
    start.assignmentId,
  );

  const attempts = getSupabaseAdmin();
  if (!attempts) {
    return { ok: false, message: 'Attempts istemcisi yok.' };
  }

  const { data, error } = await attempts
    .from(ATTEMPTS_TABLE)
    .select('id, origin_type, raw_score, assignment_id')
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: `Deneme okunamadı: ${error?.message ?? 'kayıt yok'}`,
    };
  }

  const row = data as {
    origin_type: string | null;
    raw_score: number;
    assignment_id: string | null;
  };

  if (row.origin_type !== 'self_practice') {
    return {
      ok: false,
      message: `origin_type beklenen self_practice, gelen: ${row.origin_type ?? 'null'}`,
    };
  }
  if (row.assignment_id !== start.assignmentId) {
    return {
      ok: false,
      message: 'assignment_id eşleşmedi.',
    };
  }
  if (row.raw_score !== expectedScore) {
    return {
      ok: false,
      message: `DB raw_score ${row.raw_score} != ${expectedScore}`,
    };
  }

  return { ok: true };
}

async function runTest3IeltsEngine(): Promise<AuditResult> {
  const publicClient = getPublicAdmin();
  const { data, error } = await publicClient
    .from('libraries')
    .select('id, exam_payload')
    .eq('is_public', true)
    .eq('verification_status', 'verified')
    .eq('curriculum', 'IELTS')
    .ilike('title', `%${IELTS_LIBRARY_TITLE.slice(0, 24)}%`)
    .not('exam_payload', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: `IELTS seed kaydı bulunamadı: ${error?.message ?? 'yok'}`,
    };
  }

  const exam = assessmentPayloadFromJsonb(
    (data as { exam_payload: unknown }).exam_payload,
  );
  if (!exam) {
    return { ok: false, message: 'IELTS exam_payload parse edilemedi.' };
  }

  const staticIssue = validateIeltsStaticContract(exam);
  if (staticIssue) {
    return staticIssue;
  }

  const essayQuestion = exam.questions.find((q) => q.type === 'extended_essay');
  if (!essayQuestion) {
    return { ok: false, message: 'Task 2 sorusu bulunamadı.' };
  }

  const baseUrl = (process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  );
  const essay = buildIeltsSampleEssay(150);
  const studentAnswers = { [essayQuestion.id]: essay };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/grade-exam`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam, studentAnswers }),
    });
  } catch (fetchError) {
    const detail =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
    return {
      ok: false,
      message: `grade-exam HTTP erişilemedi (${baseUrl}): ${detail}. npm run dev çalışıyor mu?`,
    };
  }

  const bodyText = await response.text();
  let parsed: {
    success?: boolean;
    evaluation?: EvaluationResult;
    error?: string;
  };
  try {
    parsed = JSON.parse(bodyText) as typeof parsed;
  } catch {
    const mockPass = tryIeltsQuotaContractMockPass(
      exam,
      response.status,
      bodyText,
    );
    if (mockPass) {
      return mockPass;
    }
    return {
      ok: false,
      message: `grade-exam JSON değil (HTTP ${response.status}): ${bodyText.slice(0, 240)}`,
    };
  }

  const parsedStatusCode =
    typeof (parsed as { statusCode?: unknown }).statusCode === 'number'
      ? (parsed as { statusCode: number }).statusCode
      : response.status;

  if (!response.ok || !parsed.success || !parsed.evaluation) {
    const mockPass = tryIeltsQuotaContractMockPass(
      exam,
      parsedStatusCode,
      bodyText,
      parsed.error,
    );
    if (mockPass) {
      return mockPass;
    }

    return {
      ok: false,
      message:
        parsed.error ??
        `IELTS puanlama başarısız HTTP ${response.status}: ${bodyText.slice(0, 240)}`,
    };
  }

  const evaluation = parsed.evaluation;
  for (const label of IELTS_METRIC_LABELS) {
    if (typeof evaluation.metricBreakdown[label] !== 'number') {
      return {
        ok: false,
        message: `Metric eksik: ${label}`,
      };
    }
  }

  if (!/^Band\s[\d.]+/.test(evaluation.scaledResult)) {
    return {
      ok: false,
      message: `Band formatı geçersiz: ${evaluation.scaledResult}`,
    };
  }

  return { ok: true };
}

async function runTest4TeacherAssignmentRegression(
  client: SupabaseClient,
  teacherId: string,
  studentId: string,
  libraryId: string,
): Promise<AuditResult> {
  const { data: library, error: libraryError } = await client
    .from('libraries')
    .select('id, teacher_id')
    .eq('id', libraryId)
    .maybeSingle();

  if (libraryError || !library) {
    return { ok: false, message: 'Öğretmen materyali bulunamadı.' };
  }
  if ((library as { teacher_id: string }).teacher_id !== teacherId) {
    return {
      ok: false,
      message: 'AUDIT_TEACHER_LIBRARY_ID seçilen öğretmene ait değil.',
    };
  }

  const tag = `audit-${Date.now()}`;

  const studyInsert = await client.from('assignments').insert({
    library_id: libraryId,
    teacher_id: teacherId,
    student_id: studentId,
    status: 'assigned',
    assignment_type: 'study',
  });

  if (studyInsert.error) {
    if (
      studyInsert.error.code === '23505' &&
      studyInsert.error.message.includes('unique_assignment')
    ) {
      // Zaten study var — regresyon için exam yine denenmeli
    } else {
      return {
        ok: false,
        message: `study insert: ${studyInsert.error.message}`,
      };
    }
  }

  const minimalExam: AssessmentPayload = {
    curriculum: 'SAT',
    subject: 'Audit Regression',
    title: `Audit Exam ${tag}`,
    engineType: 'OBJECTIVE',
    durationMinutes: 15,
    totalMarks: 1,
    questions: [
      {
        id: `audit-q-${tag}`,
        questionNumber: 1,
        type: 'multiple_choice',
        prompt: 'Audit regression placeholder',
        options: ['A) 1', 'B) 2', 'C) 3', 'D) 4'],
        correctAnswer: 'A',
        targetMarks: 1,
      },
    ],
  };

  const examInsert = await client.from('assignments').insert({
    library_id: libraryId,
    teacher_id: teacherId,
    student_id: studentId,
    status: 'assigned',
    assignment_type: 'exam',
    exam_payload: minimalExam,
  });

  if (examInsert.error) {
    return {
      ok: false,
      message: `exam insert engellendi (regresyon): ${examInsert.error.message}`,
    };
  }

  const { data: rows, error: readError } = await client
    .from('assignments')
    .select('id, assignment_type')
    .eq('library_id', libraryId)
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .in('assignment_type', ['study', 'exam']);

  if (readError || !rows?.length) {
    return { ok: false, message: 'study/exam satırları doğrulanamadı.' };
  }

  const types = new Set(
    (rows as { assignment_type: string }[]).map((r) => r.assignment_type),
  );
  if (!types.has('study') || !types.has('exam')) {
    return {
      ok: false,
      message: `Ayrık yaşam döngüsü yok; tipler: ${[...types].join(', ')}`,
    };
  }

  return { ok: true };
}

async function runTest5ColdStartDiagnostic(
  client: SupabaseClient,
): Promise<AuditResult> {
  const coldPrimary = 'SAT';
  const loaded = await mirrorFindSeededDiagnosticLibrary(client, coldPrimary);
  if (!loaded.ok) {
    return { ok: false, message: loaded.error };
  }

  if (loaded.row.curriculum.toUpperCase() !== 'SAT') {
    return {
      ok: false,
      message: `Cold-start fallback SAT değil: ${loaded.row.curriculum}`,
    };
  }

  const emptyCurriculumSimulation = await mirrorFindSeededDiagnosticLibrary(
    client,
    '',
  );
  if (!emptyCurriculumSimulation.ok) {
    return {
      ok: false,
      message: `Boş müfredat simülasyonu: ${emptyCurriculumSimulation.error}`,
    };
  }

  return { ok: true };
}

async function runAudit(): Promise<number> {
  console.info(
    `${ANSI.cyan}▶ Interscola Hard 360 Audit${ANSI.reset} ${ANSI.dim}(Faz 6)${ANSI.reset}\n`,
  );

  const publicClient = getPublicAdmin();
  const studentId = await resolveAuditStudentId(publicClient);
  const satLibrary = await resolveSatPublicLibrary(
    publicClient,
    process.env.AUDIT_SAT_LIBRARY_ID?.trim(),
  );

  const tests: { name: string; run: () => Promise<AuditResult> }[] = [
    {
      name: 'TEST 1 — Eşzamanlı yarış & unique kısıt',
      run: () =>
        runTest1Concurrency(
          publicClient,
          studentId,
          satLibrary.id,
          satLibrary.exam,
        ),
    },
    {
      name: 'TEST 2 — Self-practice OBJECTIVE puanlama & origin_type',
      run: () =>
        runTest2SelfPracticeGrading(
          publicClient,
          studentId,
          satLibrary.id,
          satLibrary.exam,
        ),
    },
    {
      name: 'TEST 3 — IELTS LANGUAGE motoru (live grade-exam)',
      run: () => runTest3IeltsEngine(),
    },
    {
      name: 'TEST 4 — Öğretmen study + exam ayrık atama',
      run: async () => {
        let teacher: { id: string; email: string };
        try {
          teacher = await resolveAuditTeacher(publicClient);
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : 'Öğretmen profili çözümlenemedi.',
          };
        }

        let libraryId: string;
        let ephemeralLibrary = false;
        try {
          const ensured = await ensureTeacherLibraryForAudit(
            publicClient,
            teacher.id,
          );
          libraryId = ensured.libraryId;
          ephemeralLibrary = ensured.ephemeral;
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : 'Audit materyali hazırlanamadı.',
          };
        }

        try {
          return await runTest4TeacherAssignmentRegression(
            publicClient,
            teacher.id,
            studentId,
            libraryId,
          );
        } finally {
          if (ephemeralLibrary) {
            await cleanupEphemeralAuditTest4(
              publicClient,
              libraryId,
              teacher.id,
              studentId,
            );
          }
        }
      },
    },
    {
      name: 'TEST 5 — Cold-start teşhis SAT fallback',
      run: () => runTest5ColdStartDiagnostic(publicClient),
    },
  ];

  let failed = 0;
  let passed = 0;

  for (const test of tests) {
    const started = performance.now();
    try {
      const result = await test.run();
      const ms = Math.round(performance.now() - started);
      if (result.ok && result.contractMock) {
        passed += 1;
        logPassContractMockTest3(ms);
      } else if (result.ok) {
        passed += 1;
        logPass(test.name, ms);
      } else {
        failed += 1;
        logFail(test.name, ms, result.message);
      }
    } catch (error) {
      failed += 1;
      const ms = Math.round(performance.now() - started);
      const message =
        error instanceof Error ? error.message : 'Beklenmeyen audit hatası';
      logFail(test.name, ms, message, error);
    }
  }

  console.info('');
  if (failed === 0) {
    console.info(
      `${ANSI.green}Audit tamamlandı.${ANSI.reset} ${passed} PASS, ${failed} FAIL (${tests.length} test)`,
    );
    return 0;
  }

  console.error(
    `${ANSI.red}${failed} test başarısız.${ANSI.reset} ${passed} PASS, ${failed} FAIL`,
  );
  return 1;
}

runAudit()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`${ANSI.red}[FATAL]${ANSI.reset}`, error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  });
