import { runGenerateExam } from '@/app/api/generate-exam/route';
import { parseAssessmentPayload } from '@/lib/assessment-payload';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import type { AssessmentPayload } from '@/types/exam';

/** Havuz SAT: token/latency güvenliği için 10 soru (5 R&W + 5 Math — prompt’ta zorunlu). */
const POOL_SAT_QUESTIONS = 10;
const POOL_IELTS_QUESTIONS = 2;

/** SAT ve IELTS üretimlerini aynı cron turunda üst üste binmeden sıralamak için nefes payı (ms). */
const BETWEEN_POOL_EXAMS_MS = 1_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoWeekLabel(date = new Date()): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function finalizePoolExam(
  exam: AssessmentPayload,
  curriculum: 'SAT' | 'IELTS',
  weekLabel: string,
): AssessmentPayload {
  const validated = parseAssessmentPayload(exam);
  return {
    ...validated,
    title: `✨ YENİ · Hazır Tam Deneme Havuzu — ${curriculum} (${weekLabel})`,
    durationMinutes:
      curriculum === 'SAT'
        ? Math.max(validated.durationMinutes, 20)
        : Math.max(validated.durationMinutes, 18),
  };
}

async function insertPublicLibraryRow(input: {
  title: string;
  curriculum: 'SAT' | 'IELTS';
  subject: string;
  extractedText: string;
  exam: AssessmentPayload;
}): Promise<{ id: string } | { error: string }> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!admin) {
    return { error: 'Supabase service role yapılandırılmamış.' };
  }

  const { data, error } = await admin
    .from('libraries')
    .insert({
      title: input.title,
      curriculum: input.curriculum,
      subject: input.subject,
      extracted_text: input.extractedText,
      exam_payload: input.exam,
      is_public: true,
      verification_status: 'verified',
      teacher_id: null,
    })
    .select(
      'id, title, curriculum, subject, extracted_text, exam_payload, is_public, verification_status, teacher_id',
    )
    .single();

  if (error || !data) {
    return {
      error: error?.message ?? 'Kütüphane kaydı oluşturulamadı.',
    };
  }

  const row = data as {
    id: string;
    title: string;
    curriculum: string;
    subject: string;
    extracted_text: string | null;
    exam_payload: unknown;
    is_public: boolean | null;
    verification_status: string | null;
    teacher_id: string | null;
  };

  const payloadOk =
    JSON.stringify(row.exam_payload) === JSON.stringify(input.exam);
  const metaOk =
    row.title === input.title &&
    row.curriculum === input.curriculum &&
    row.subject === input.subject &&
    row.extracted_text === input.extractedText &&
    row.is_public === true &&
    row.verification_status === 'verified' &&
    row.teacher_id === null;

  if (!payloadOk || !metaOk) {
    return {
      error:
        'Kütüphane kaydı oluşturuldu ancak okunan satır istenen exam_payload / meta ile eşleşmiyor.',
    };
  }

  return { id: row.id };
}

export async function seedWeeklyPublicExams(): Promise<{
  success: boolean;
  seededCount: number;
  examIds: string[];
  errors: string[];
}> {
  const weekLabel = isoWeekLabel();
  const examIds: string[] = [];
  const errors: string[] = [];

  try {
    const satRaw = await runGenerateExam({
      curriculum: 'SAT',
      engineType: 'OBJECTIVE',
      subject: 'Reading & Writing / Math (balanced — 5 R&W + 5 Math)',
      questionCount: POOL_SAT_QUESTIONS,
      promptContext:
        'Generate a balanced Digital SAT section-practice set: exactly 5 Reading & Writing items and 5 Math items (not a full Bluebook adaptive test). Each prompt starts with [R&W] or [Math].',
    });
    const satExam = finalizePoolExam(satRaw, 'SAT', weekLabel);
    const satInsert = await insertPublicLibraryRow({
      title: satExam.title,
      curriculum: 'SAT',
      subject: 'Reading & Writing / Math',
      extractedText:
        'Interscola haftalık hazır Digital SAT tam deneme havuzu — önceden üretilmiş exam_payload.',
      exam: satExam,
    });
    if ('error' in satInsert) {
      errors.push(`SAT: ${satInsert.error}`);
    } else {
      examIds.push(satInsert.id);
    }
  } catch (error) {
    errors.push(
      `SAT üretimi: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  await sleep(BETWEEN_POOL_EXAMS_MS);

  try {
    const ieltsRaw = await runGenerateExam({
      curriculum: 'IELTS',
      engineType: 'LANGUAGE',
      subject: 'Academic Reading & Writing',
      questionCount: POOL_IELTS_QUESTIONS,
      promptContext:
        'Generate IELTS Academic style tasks covering reading comprehension and Academic Writing Task 2 style response (indicator only, not official IELTS).',
    });
    const ieltsExam = finalizePoolExam(ieltsRaw, 'IELTS', weekLabel);
    const ieltsInsert = await insertPublicLibraryRow({
      title: ieltsExam.title,
      curriculum: 'IELTS',
      subject: 'Academic Reading & Writing',
      extractedText:
        'Interscola haftalık hazır IELTS Academic paketi — önceden üretilmiş exam_payload.',
      exam: ieltsExam,
    });
    if ('error' in ieltsInsert) {
      errors.push(`IELTS: ${ieltsInsert.error}`);
    } else {
      examIds.push(ieltsInsert.id);
    }
  } catch (error) {
    errors.push(
      `IELTS üretimi: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    success: examIds.length > 0,
    seededCount: examIds.length,
    examIds,
    errors,
  };
}
