/**
 * Açık kütüphane teşhis sınavlarını `public.libraries` tablosuna tohumlar.
 *
 * Kullanım: npm run db:seed
 * Gerekli env (.env.local): NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { parseAssessmentPayload } from '../src/lib/assessment-payload';
import type { AssessmentPayload } from '../src/types/exam';

config({ path: resolve(process.cwd(), '.env.local') });

const SAT_LIBRARY_TITLE =
  'Digital SAT 15-Dakikalık Hızlı Seviye Tespit Sınavı (Diagnostic)';

const IELTS_LIBRARY_TITLE =
  'IELTS Academic Writing & Reading Hızlı Teşhis Testi';

const CAIE_LIBRARY_ID = 'e2e00000-0000-0000-0000-000000000003';

const CAIE_LIBRARY_TITLE =
  'CAIE Psychology 9990 — Andrade Doodling Açık Teşhis Sınavı';

const satDiagnosticExam: AssessmentPayload = {
  curriculum: 'SAT',
  subject: 'Reading & Writing / Math',
  title: SAT_LIBRARY_TITLE,
  engineType: 'OBJECTIVE',
  durationMinutes: 15,
  totalMarks: 2,
  questions: [
    {
      id: 'sat-diag-q1',
      questionNumber: 1,
      type: 'multiple_choice',
      prompt:
        'Reading & Writing — Craft and Structure\n\n' +
        'The following text is from a student essay draft.\n\n' +
        '"Many cities are redesigning public spaces to encourage walking. ' +
        'These changes not only reduce traffic congestion but also ______ ' +
        'community interaction."\n\n' +
        'Which choice completes the text with the most logical and precise word?',
      options: [
        'A) diminish',
        'B) foster',
        'C) postpone',
        'D) contradict',
      ],
      correctAnswer: 'B',
      explanation:
        'Bağlam "encourage walking" ve olumlu sonuçları vurguluyor; ' +
        '"foster community interaction" anlamlı ve tutarlıdır.',
      targetMarks: 1,
    },
    {
      id: 'sat-diag-q2',
      questionNumber: 2,
      type: 'multiple_choice',
      prompt:
        'Math — Algebra\n\nIf 6x − 2 = 16, what is the value of x?',
      options: ['A) 2', 'B) 3', 'C) 4', 'D) 5'],
      correctAnswer: 'B',
      explanation: '6x − 2 = 16 → 6x = 18 → x = 3.',
      targetMarks: 1,
    },
  ],
};

const ieltsDiagnosticExam: AssessmentPayload = {
  curriculum: 'IELTS',
  subject: 'Academic English',
  title: IELTS_LIBRARY_TITLE,
  engineType: 'LANGUAGE',
  durationMinutes: 15,
  totalMarks: 9,
  questions: [
    {
      id: 'ielts-diag-task2',
      questionNumber: 1,
      type: 'extended_essay',
      prompt:
        'Writing Task 2 (Academic)\n\n' +
        'Some people believe that unpaid community service should be a compulsory ' +
        'part of high school programmes (for example, working for a charity, ' +
        'improving the neighbourhood, or teaching sports to younger children).\n\n' +
        'To what extent do you agree or disagree?\n\n' +
        'Give reasons for your answer and include any relevant examples from your ' +
        'own knowledge or experience.\n\n' +
        'Write at least 250 words.',
      targetMarks: 9,
      rubricCriteria: {
        ielts_task_achievement:
          'Prompt tam yanıtlanır; pozisyon net, fikirler geliştirilir, örnekler destekler.',
        ielts_coherence_cohesion:
          'Paragraf organizasyonu mantıklı; bağlayıcı ifadeler tutarlı akış sağlar.',
        ielts_lexical_resource:
          'Konuya uygun kelime dağarcığı; akademik ton; tekrarlar sınırlı.',
        ielts_grammatical_range:
          'Çeşitli cümle yapıları; hata yoğunluğu anlamı bozmaz.',
      },
    },
  ],
};

const caieDiagnosticExam: AssessmentPayload = {
  curriculum: 'CAIE',
  subject: 'Psychology 9990',
  title: CAIE_LIBRARY_TITLE,
  engineType: 'RUBRIC_ESSAY',
  durationMinutes: 20,
  totalMarks: 20,
  questions: [
    {
      id: 'caie-andrade-mcq1',
      questionNumber: 1,
      type: 'multiple_choice',
      prompt:
        'Andrade (2010) doodling study\n\n' +
        'Which finding best summarises Andrade\'s results about doodling while ' +
        'listening to a monotonous telephone message?',
      options: [
        'A) Doodling reduced recall of both monitored and surprise items.',
        'B) Doodling improved recall of surprise items compared with a control condition.',
        'C) Doodling had no measurable effect on attention or memory.',
        'D) Doodling improved recall only when participants were highly motivated.',
      ],
      correctAnswer: 'B',
      explanation:
        'Andrade found doodling improved surprise recall versus control, suggesting ' +
        'it maintained attention on a boring task.',
      targetMarks: 2,
    },
    {
      id: 'caie-andrade-structured',
      questionNumber: 2,
      type: 'structured_text',
      prompt:
        'Outline two features of Andrade\'s (2010) methodology. [4 marks]\n\n' +
        'Write concise points; each feature should be identifiable to an examiner.',
      targetMarks: 4,
      rubricCriteria: {
        ao1_knowledge:
          'Accurate description of design features (e.g. lab experiment, IV/ DV, standardised message).',
        ao2_application:
          'Features linked explicitly to the Andrade doodling context.',
        ao3_evaluation:
          'Not required at full length; brief justification of feature relevance acceptable.',
      },
    },
    {
      id: 'caie-andrade-essay',
      questionNumber: 3,
      type: 'extended_essay',
      prompt:
        'Discuss strengths and weaknesses of laboratory experiments in psychology, ' +
        'using Andrade\'s doodling study as an example. [14 marks]\n\n' +
        'Your answer should include AO1 knowledge, AO2 application to Andrade, ' +
        'and AO3 evaluation with a reasoned conclusion.',
      targetMarks: 14,
      rubricCriteria: {
        ao1_knowledge:
          'Relevant knowledge of lab experiments (control, standardisation, replication).',
        ao2_application:
          'Application to Andrade: task, sample, measures, findings.',
        ao3_evaluation:
          'Balanced strengths/weaknesses (validity, ethics, generalisability) with judgement.',
      },
    },
  ],
};

interface LibrarySeedRecord {
  id?: string;
  title: string;
  curriculum: string;
  subject: string;
  extracted_text: string;
  exam_payload: AssessmentPayload;
  is_public: boolean;
  verification_status: 'verified';
  teacher_id: null;
}

const SEED_RECORDS: LibrarySeedRecord[] = [
  {
    title: SAT_LIBRARY_TITLE,
    curriculum: 'SAT',
    subject: 'Reading & Writing / Math',
    extracted_text:
      'Digital SAT hızlı seviye tespiti: Craft & Structure okuma sorusu ve ' +
      'temel cebir (6x − 2) ile resmi OBJECTIVE motor formatında kısa teşhis.',
    is_public: true,
    verification_status: 'verified',
    teacher_id: null,
    exam_payload: satDiagnosticExam,
  },
  {
    title: IELTS_LIBRARY_TITLE,
    curriculum: 'IELTS',
    subject: 'Academic English',
    extracted_text:
      'IELTS Academic Task 2 teşhis yazısı: unpaid community service zorunluluğu ' +
      'tartışması; dört resmi IELTS rubrik kriteri ile LANGUAGE motoru.',
    is_public: true,
    verification_status: 'verified',
    teacher_id: null,
    exam_payload: ieltsDiagnosticExam,
  },
  {
    id: CAIE_LIBRARY_ID,
    title: CAIE_LIBRARY_TITLE,
    curriculum: 'CAIE',
    subject: 'Psychology 9990',
    extracted_text:
      'Cambridge International A Level Psychology 9990 — Andrade (2010) doodling ' +
      'study: MCQ, structured outline (4 marks) and extended evaluation essay (14 marks).',
    is_public: true,
    verification_status: 'verified',
    teacher_id: null,
    exam_payload: caieDiagnosticExam,
  },
];

function resolveSupabaseConfig(): { url: string; serviceRoleKey: string } {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    '';

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL (veya SUPABASE_URL) ve SUPABASE_SERVICE_ROLE_KEY ' +
        '(veya SUPABASE_SERVICE_KEY) .env.local içinde tanımlı olmalı.',
    );
  }

  return { url, serviceRoleKey };
}

function validateSeedPayloads(): void {
  for (const record of SEED_RECORDS) {
    parseAssessmentPayload(record.exam_payload);
  }
}

export async function runSeed(): Promise<void> {
  validateSeedPayloads();

  const { url, serviceRoleKey } = resolveSupabaseConfig();

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const record of SEED_RECORDS) {
    const payload = {
      title: record.title,
      curriculum: record.curriculum,
      subject: record.subject,
      extracted_text: record.extracted_text,
      exam_payload: record.exam_payload,
      is_public: record.is_public,
      verification_status: record.verification_status,
      teacher_id: record.teacher_id,
    };

    const lookupQuery = record.id
      ? client.from('libraries').select('id, title').eq('id', record.id)
      : client.from('libraries').select('id, title').eq('title', record.title);

    const { data: existing, error: lookupError } = await lookupQuery.maybeSingle();

    if (lookupError) {
      failed += 1;
      console.error(
        `[seed] "${record.title}" aranırken hata:`,
        lookupError.message,
      );
      continue;
    }

    if (existing?.id) {
      const { error: updateError } = await client
        .from('libraries')
        .update(payload)
        .eq('id', existing.id);

      if (updateError) {
        failed += 1;
        console.error(
          `[seed] "${record.title}" güncellenemedi:`,
          updateError.message,
        );
        continue;
      }

      updated += 1;
      console.info(`[seed] Güncellendi: ${record.title} (id: ${existing.id})`);
      continue;
    }

    const insertPayload = record.id ? { id: record.id, ...payload } : payload;

    const { data: insertedRow, error: insertError } = await client
      .from('libraries')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError || !insertedRow) {
      failed += 1;
      console.error(
        `[seed] "${record.title}" eklenemedi:`,
        insertError?.message ?? 'bilinmeyen hata',
      );
      continue;
    }

    inserted += 1;
    console.info(
      `[seed] Eklendi: ${record.title} (id: ${(insertedRow as { id: string }).id})`,
    );
  }

  console.info(
    `[seed] Tamamlandı — eklenen: ${inserted}, güncellenen: ${updated}, hata: ${failed}`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('seed-exams.ts') ||
    process.argv[1].endsWith('seed-exams.js'));

if (isDirectRun) {
  runSeed().catch((error: unknown) => {
    console.error(
      '[seed] Beklenmeyen hata:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
}
