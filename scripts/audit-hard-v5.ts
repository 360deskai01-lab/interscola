/**
 * Hard Audit Harness 5.0 — Süre motoru, kurtarma, boş payload, şeffaflık, error boundaries (DB/HTTP yok).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  decorateExamForSessionFormat,
  resolveExamSessionDurationSeconds,
} from '../src/lib/exam/exam-session-formats';
import {
  type ExamSessionRecoverySnapshot,
  resolveExamSessionRecoveryTiming,
} from '../src/lib/exam/exam-session-recovery';
import {
  buildStudentAnswersPayload,
  hasSubstantiveAnswerInPayload,
} from '../src/lib/exam/student-answers-payload';
import { evaluationForUnansweredExam } from '../src/lib/exam/unanswered-exam-evaluation';
import { getScoreTransparencyCopy } from '../src/lib/exam/score-transparency';
import { buildBadges } from '../src/lib/exam-shared';
import type { AssessmentPayload, EvaluationResult } from '../src/types/exam';

const ROOT = resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean): void {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed += 1;
    return;
  }
  console.error(`[FAIL] ${name}`);
  failed += 1;
}

function recoverySnapshot(
  deadlineAt: number,
): ExamSessionRecoverySnapshot {
  return {
    version: 1,
    answers: {},
    currentIndex: 0,
    deadlineAt,
    savedAt: new Date().toISOString(),
  };
}

function mcqQuestion(id: string, n: number): AssessmentPayload['questions'][0] {
  return {
    id,
    questionNumber: n,
    type: 'multiple_choice',
    prompt: `Audit MCQ ${n}`,
    options: ['A) 1', 'B) 2', 'C) 3', 'D) 4'],
    correctAnswer: 'A',
    targetMarks: 1,
  };
}

function essayQuestion(id: string, n: number): AssessmentPayload['questions'][0] {
  return {
    id,
    questionNumber: n,
    type: 'extended_essay',
    prompt: `Audit essay ${n}`,
    targetMarks: 20,
  };
}

function runGroup1TimerContract(): void {
  console.log('\n=== Grup 1: Süre ve sayaç sözleşmesi ===');

  const caieBase: AssessmentPayload = {
    curriculum: 'CAIE',
    subject: 'Economics',
    title: 'Diagnostic Drill — Audit CAIE',
    engineType: 'RUBRIC_ESSAY',
    durationMinutes: 20,
    totalMarks: 25,
    questions: [essayQuestion('c1', 1)],
  };
  const caieDrill = decorateExamForSessionFormat(
    caieBase,
    'diagnostic_drill',
    'CAIE',
  );
  const caieSeconds = resolveExamSessionDurationSeconds(caieDrill);
  assert(
    'timer: CAIE diagnostic >= 720 sn ve drill 15 dk (900 sn)',
    caieSeconds >= 720 && caieSeconds === 900,
  );

  const ieltsBase: AssessmentPayload = {
    ...caieBase,
    curriculum: 'IELTS',
    title: 'Diagnostic Drill — Audit IELTS',
    engineType: 'LANGUAGE',
    questions: [essayQuestion('i1', 1)],
  };
  const ieltsDrill = decorateExamForSessionFormat(
    ieltsBase,
    'diagnostic_drill',
    'IELTS',
  );
  const ieltsSeconds = resolveExamSessionDurationSeconds(ieltsDrill);
  assert('timer: IELTS diagnostic >= 900 sn', ieltsSeconds >= 900);

  const satBase: AssessmentPayload = {
    curriculum: 'SAT',
    subject: 'Reading & Writing',
    title: 'Diagnostic Drill — Audit SAT',
    engineType: 'OBJECTIVE',
    durationMinutes: 60,
    totalMarks: 4,
    questions: [mcqQuestion('s1', 1), mcqQuestion('s2', 2)],
  };
  const satDrill = decorateExamForSessionFormat(
    satBase,
    'diagnostic_drill',
    'SAT',
  );
  const satSeconds = resolveExamSessionDurationSeconds(satDrill);
  assert('timer: SAT diagnostic >= 480 sn (8 dk)', satSeconds >= 480);

  const minutesFifteenNotSeconds: AssessmentPayload = {
    ...caieDrill,
    durationMinutes: 15,
  };
  assert(
    'timer: durationMinutes 15 → 900 sn (dakika, saniye değil)',
    resolveExamSessionDurationSeconds(minutesFifteenNotSeconds) === 900,
  );

  const suspiciousLow: AssessmentPayload = {
    ...caieDrill,
    durationMinutes: 14,
  };
  assert(
    'timer: taban altı 14 dk → taban 15 dk (900 sn)',
    resolveExamSessionDurationSeconds(suspiciousLow) === 900,
  );

  const secondsInMinutesField: AssessmentPayload = {
    ...caieDrill,
    durationMinutes: 900,
  };
  assert(
    'timer: alanda 900 → 900 sn (saniye-heuristic)',
    resolveExamSessionDurationSeconds(secondsInMinutesField) === 900,
  );
}

function runGroup2RecoveryGuard(): void {
  console.log('\n=== Grup 2: Oturum kurtarma kalkanı ===');

  const now = 1_700_000_000_000;
  const official = 900;

  const fresh = resolveExamSessionRecoveryTiming(null, official, now);
  assert(
    'recovery: snapshot yok → tam süre',
    fresh.trustRecoverySnapshot === false && fresh.sessionSeconds === official,
  );

  const expired = resolveExamSessionRecoveryTiming(
    recoverySnapshot(now - 1),
    official,
    now,
  );
  assert(
    'recovery: deadlineAt geçmiş → güvensiz',
    expired.trustRecoverySnapshot === false &&
      expired.sessionSeconds === official,
  );

  const tooShort = resolveExamSessionRecoveryTiming(
    recoverySnapshot(now + 45_000),
    official,
    now,
  );
  assert(
    'recovery: kalan < 60 sn → güvensiz + tam süre',
    tooShort.trustRecoverySnapshot === false &&
      tooShort.sessionSeconds === official,
  );

  const trusted = resolveExamSessionRecoveryTiming(
    recoverySnapshot(now + 600_000),
    official,
    now,
  );
  assert(
    'recovery: 600 sn kalan → güvenilir',
    trusted.trustRecoverySnapshot === true && trusted.sessionSeconds === 600,
  );
}

function runGroup3EmptyPayloadAndTimeout(): void {
  console.log('\n=== Grup 3: Boş payload & zaman aşımı değerlendirmesi ===');

  const satExam: AssessmentPayload = {
    curriculum: 'SAT',
    subject: 'Math',
    title: 'SAT Audit',
    engineType: 'OBJECTIVE',
    durationMinutes: 15,
    totalMarks: 2,
    questions: [mcqQuestion('a', 1), mcqQuestion('b', 2)],
  };

  const emptyPayload = buildStudentAnswersPayload(satExam, {});
  assert(
    'payload: her soru id için boş string',
    satExam.questions.every(
      (q) =>
        Object.prototype.hasOwnProperty.call(emptyPayload, q.id) &&
        emptyPayload[q.id] === '',
    ),
  );
  assert(
    'payload: boş gövde substantive değil',
    !hasSubstantiveAnswerInPayload(emptyPayload),
  );

  const satZero = evaluationForUnansweredExam(satExam);
  assert(
    'grade: SAT boş → 0/1600, doğruluk %0',
    satZero.score === 0 &&
      satZero.scaledResult === '0 / 1600' &&
      satZero.metricBreakdown.dogrulukYuzdesi === 0,
  );

  const caieExam: AssessmentPayload = {
    curriculum: 'CAIE',
    subject: 'Economics',
    title: 'CAIE Audit',
    engineType: 'RUBRIC_ESSAY',
    durationMinutes: 15,
    totalMarks: 20,
    questions: [essayQuestion('e1', 1)],
  };
  const caieZero = evaluationForUnansweredExam(caieExam);
  assert(
    'grade: CAIE boş → Grade U, yuzde 0',
    caieZero.score === 0 &&
      caieZero.scaledResult === 'Grade U' &&
      caieZero.metricBreakdown.yuzde === 0,
  );

  const ieltsExam: AssessmentPayload = {
    curriculum: 'IELTS',
    subject: 'Writing',
    title: 'IELTS Audit',
    engineType: 'LANGUAGE',
    durationMinutes: 15,
    totalMarks: 20,
    questions: [essayQuestion('w1', 1)],
  };
  const ieltsZero = evaluationForUnansweredExam(ieltsExam);
  assert(
    'grade: IELTS boş → Band 1.0',
    ieltsZero.scaledResult === 'Band 1.0' && ieltsZero.score === 1,
  );

  const timedOutEval: EvaluationResult = {
    ...satZero,
    is_timed_out: true,
  };
  const badges = buildBadges('OBJECTIVE', timedOutEval, false, false);
  assert(
    'badge: is_timed_out → Zaman Aşımı rozeti',
    badges.some((b) =>
      b.label.includes('Zaman Aşımı (Süresinde Yetiştirilemedi)'),
    ),
  );
}

function runGroup4TransparencyCopy(): void {
  console.log('\n=== Grup 4: Şeffaflık ve karne metin sözleşmeleri ===');

  const sat = getScoreTransparencyCopy('SAT', 'OBJECTIVE');
  assert(
    'transparency: SAT Bluebook adaptif feragatnamesi',
    sat.footnote.includes('Bluebook') &&
      sat.footnote.includes('adaptif'),
  );

  const ielts = getScoreTransparencyCopy('IELTS', 'LANGUAGE');
  assert(
    'transparency: IELTS Listening/Speaking notu',
    ielts.footnote.includes('Listening') &&
      ielts.footnote.includes('Speaking'),
  );

  const caie = getScoreTransparencyCopy('CAIE', 'RUBRIC_ESSAY');
  assert(
    'transparency: CAIE tekil vaka analizi dipnotu',
    caie.footnote.includes('tek bir vaka analizi'),
  );
}

function runGroup5ErrorBoundaries(): void {
  console.log('\n=== Grup 5: Error & not-found boundaries ===');

  const notFound = resolve(ROOT, 'src/app/not-found.tsx');
  assert('boundary: not-found.tsx mevcut', existsSync(notFound));
  const notFoundSrc = readFileSync(notFound, 'utf8');
  assert(
    'boundary: 404 başlık metni',
    notFoundSrc.includes('Sayfa Bulunamadı (404)'),
  );

  const errorRoutes: { path: string; mustHaveClient: boolean; marker: string }[] =
    [
      {
        path: 'src/app/student/error.tsx',
        mustHaveClient: true,
        marker: 'Küçük Bir Bağlantı Pürüzü',
      },
      {
        path: 'src/app/teacher/error.tsx',
        mustHaveClient: true,
        marker: 'Öğretmen Masasında Bir Hata',
      },
      {
        path: 'src/app/coordinator/error.tsx',
        mustHaveClient: true,
        marker: 'Kurumsal Portal Bağlantı Uyarısı',
      },
    ];

  for (const route of errorRoutes) {
    const full = resolve(ROOT, route.path);
    assert(`boundary: ${route.path} mevcut`, existsSync(full));
    const src = readFileSync(full, 'utf8');
    assert(
      `boundary: ${route.path} use client`,
      !route.mustHaveClient || src.includes("'use client'"),
    );
    assert(
      `boundary: ${route.path} reset prop sözleşmesi`,
      src.includes('reset') && src.includes('Error'),
    );
    assert(`boundary: ${route.path} pedagogik başlık`, src.includes(route.marker));
  }
}

function main(): void {
  console.log('Interscola Hard Audit Harness 5.0\n');

  runGroup1TimerContract();
  runGroup2RecoveryGuard();
  runGroup3EmptyPayloadAndTimeout();
  runGroup4TransparencyCopy();
  runGroup5ErrorBoundaries();

  const total = passed + failed;
  console.log('\n--- Özet ---');
  console.log(`Toplam assertion: ${total}`);
  console.log(`Geçen: ${passed}`);
  console.log(`Kalan: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
    console.error('\nAudit FAILED.');
    return;
  }
  console.log('\nAudit PASSED — tüm kontroller [PASS].');
}

main();
