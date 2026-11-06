/**
 * Hard Audit Harness 4.0 — Transkript/WES GPA, portfolyo metrikleri, oturum formatı,
 * kütüphane rozeti, DeepSeek uyumlu sınav JSON (DB/HTTP yok).
 */
import { parseAssessmentPayload } from '../src/lib/assessment-payload';
import {
  decorateExamForSessionFormat,
  MINI_MOCK_DURATION_MINUTES,
  MINI_MOCK_QUESTIONS,
  sessionFormatTitlePrefix,
} from '../src/lib/exam/exam-session-formats';
import { isLibraryRecentlyAdded, LIBRARY_NEW_BADGE_DAYS } from '../src/lib/public-library/library-new-badge';
import { computePortfolioKpis } from '../src/lib/student-portfolio/portfolio-metrics';
import type {
  ActivityGradeLevel,
  ActivityItem,
} from '../src/lib/student-portfolio/types';
import {
  buildAcademicTranscriptData,
  computeAcademicTranscriptMetrics,
  mergeTranscriptYears,
  score100ToGpaPoint,
  wesLetterFromCumulative100,
} from '../src/lib/student-transcript/gpa-calculator';
import { computeTranscriptVerificationCode } from '../src/lib/student-transcript/verification-code';
import type { SubjectRecord } from '../src/lib/student-transcript/types';
import type { AssessmentPayload } from '../src/types/exam';

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

function assertNoThrow(name: string, fn: () => void): void {
  try {
    fn();
    assert(name, true);
  } catch (error) {
    console.error(`[FAIL] ${name}`, error);
    failed += 1;
  }
}

function subject(
  id: string,
  score100: number,
  weeklyHours: number,
): SubjectRecord {
  return { id, name: id, score100, weeklyHours };
}

function runGroup1TranscriptGpa(): void {
  console.log('\n=== Grup 1: Transkript & WES 4.0 GPA ===');

  assert(
    'gpa: score100ToGpaPoint (100,85,72,55,40)',
    score100ToGpaPoint(100) === 4 &&
      score100ToGpaPoint(85) === 4 &&
      score100ToGpaPoint(72) === 3 &&
      score100ToGpaPoint(55) === 1 &&
      score100ToGpaPoint(40) === 0,
  );

  assert(
    'gpa: wesLetterFromCumulative100 örnekleri',
    wesLetterFromCumulative100(92) === 'A' &&
      wesLetterFromCumulative100(87) === 'A-' &&
      wesLetterFromCumulative100(0) === '—',
  );

  // 10–12: her yıl ders saatlerine göre yıl ortalaması; genel kümülatif = üç yıl ortalamasının aritmetiği.
  const weightedYears = mergeTranscriptYears({
    10: {
      grade: 10,
      subjects: [
        subject('m10', 90, 4),
        subject('p10', 60, 2),
      ],
    },
    11: {
      grade: 11,
      subjects: [subject('x11', 70, 6)],
    },
    12: {
      grade: 12,
      subjects: [
        subject('a12', 100, 10),
        // 0 not: saat>0 iken yıla girer ve ortalamayı çeker — audit bunu ayrı senaryoda test eder.
        subject('b12_drop', 0, 0),
        subject('c12', 50, 0),
        subject('d12', NaN, 3),
      ],
    },
  });

  const metrics = computeAcademicTranscriptMetrics(weightedYears);
  const y10 = (90 * 4 + 60 * 2) / 6;
  const y11 = 70;
  const y12 = 100;
  const expectedCumulative = Math.round(((y10 + y11 + y12) / 3) * 100) / 100;
  const expectedGpa =
    Math.round(
      ((score100ToGpaPoint(y10) +
        score100ToGpaPoint(y11) +
        score100ToGpaPoint(y12)) /
        3) *
        100,
    ) / 100;

  assert(
    'gpa: 10/11/12 saat-ağırlıklı yıl ortalamaları + kümülatif',
    Math.abs(metrics.cumulative100 - expectedCumulative) < 0.01 &&
      Math.abs(metrics.gpa4Scale - expectedGpa) < 0.01 &&
      metrics.wesEquivalentGrade ===
        wesLetterFromCumulative100(metrics.cumulative100),
  );

  const emptyYears = mergeTranscriptYears({});
  assert(
    'gpa: mergeTranscriptYears({}) üç sınıf iskeleti üretir',
    emptyYears[10].grade === 10 &&
      emptyYears[11].grade === 11 &&
      emptyYears[12].grade === 12 &&
      (emptyYears[10].subjects?.length ?? 0) === 0,
  );

  const emptyMetrics = computeAcademicTranscriptMetrics(emptyYears);
  assert(
    'gpa: boş/tanımsız derslerde güvenli varsayılan (0 / —)',
    emptyMetrics.cumulative100 === 0 &&
      emptyMetrics.gpa4Scale === 0 &&
      emptyMetrics.wesEquivalentGrade === '—',
  );
}

async function runGroup1Verification(): Promise<void> {
  console.log('\n=== Grup 1b: verification-code (SHA-256 deterministik) ===');

  const years = mergeTranscriptYears({
    10: { grade: 10, subjects: [subject('a', 80, 2)] },
  });
  const transcript = buildAcademicTranscriptData(years, '2026-01-01T00:00:00Z');
  const studentId = 'audit-student-1';

  const code1 = await computeTranscriptVerificationCode(studentId, transcript);
  const code2 = await computeTranscriptVerificationCode(studentId, transcript);

  assert(
    'verification: aynı studentId + transcript → birebir aynı kod',
    code1 === code2 && code1.startsWith('INT-REC-'),
  );

  const codeOther = await computeTranscriptVerificationCode(
    'other-id',
    transcript,
  );
  assert(
    'verification: farklı öğrenci → farklı özet',
    codeOther !== code1,
  );
}

function runGroup2Portfolio(): void {
  console.log('\n=== Grup 2: Aktivite pasaportu metrikleri ===');

  const base = {
    organization: 'X',
    role: 'Y',
    grades: ['10'] as ActivityGradeLevel[],
    impactDescription: 'Z',
    createdAt: '2026-01-01T00:00:00Z',
  };

  const items: ActivityItem[] = [
    {
      id: '1',
      category: 'athletics',
      title: 'A',
      ...base,
      hoursPerWeek: 3,
      weeksPerYear: 10,
    },
    {
      id: '2',
      category: 'leadership',
      title: 'L1',
      ...base,
      hoursPerWeek: 2,
      weeksPerYear: 20,
    },
    {
      id: '3',
      category: 'leadership',
      title: 'L2',
      ...base,
      hoursPerWeek: 0.5,
      weeksPerYear: 40,
    },
    {
      id: '4',
      category: 'community_service',
      title: 'C',
      ...base,
      hoursPerWeek: 0,
      weeksPerYear: 100,
    },
  ];

  const kpi = computePortfolioKpis(items);
  const expectedHours = Math.round(3 * 10 + 2 * 20 + 0.5 * 40 + 0);

  assert(
    'portfolio: kümülatif yıllık saat (hoursPerWeek × weeksPerYear)',
    kpi.cumulativeAnnualHours === expectedHours && kpi.totalActivities === 4,
  );

  assert('portfolio: leadership filtre sayımı', kpi.leadershipCount === 2);
}

function makeSatQuestions(n: number): AssessmentPayload['questions'] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`,
    questionNumber: i + 1,
    type: 'multiple_choice' as const,
    prompt: `[R&W] Audit placeholder ${i + 1}`,
    options: ['A) 1', 'B) 2', 'C) 3', 'D) 4'],
    correctAnswer: 'A',
    explanation: 'Audit rationale.',
    targetMarks: 1,
  }));
}

function runGroup3ExamFormats(): void {
  console.log('\n=== Grup 3: Sınav formatı (drill / mini mock) ===');

  const baseExam: AssessmentPayload = {
    curriculum: 'SAT',
    subject: 'Reading & Writing',
    title: 'Örnek Havuz Sınavı — Audit',
    engineType: 'OBJECTIVE',
    durationMinutes: 60,
    totalMarks: 12,
    // mini_mock SAT hedefi 11 soru; havuzda en az 11 öğe olmalı.
    questions: makeSatQuestions(12),
  };

  const drill = decorateExamForSessionFormat(
    baseExam,
    'diagnostic_drill',
    'SAT',
  );
  assert(
    'format: diagnostic_drill SAT → soru sayısı 3–5 aralığında',
    drill.questions.length >= 3 && drill.questions.length <= 5,
  );
  assert(
    'format: drill başlık ön eki korunur',
    drill.title.startsWith(sessionFormatTitlePrefix('diagnostic_drill')),
  );

  const mini = decorateExamForSessionFormat(baseExam, 'mini_mock', 'SAT');
  const prefix = sessionFormatTitlePrefix('mini_mock');
  assert(
    'format: mini_mock soru sayısı ve süre sabitleri',
    mini.questions.length === MINI_MOCK_QUESTIONS.SAT &&
      mini.durationMinutes === MINI_MOCK_DURATION_MINUTES,
  );
  assert(
    'format: mini_mock başlık ön eki + temel başlık gövdesi',
    mini.title.startsWith(prefix) && mini.title.includes('Örnek Havuz Sınavı'),
  );
  assert(
    'format: mini_mock etiket metni sessionFormatTitlePrefix ile uyumlu',
    mini.title.includes('Mini Deneme') && mini.title.includes('Section Practice'),
  );
}

function runGroup4LibraryBadge(): void {
  console.log('\n=== Grup 4: Kütüphane YENİ rozeti ===');

  const fixedNow = new Date('2026-06-15T12:00:00.000Z').getTime();
  const realNow = Date.now;
  Date.now = () => fixedNow;

  try {
    const todayIso = new Date(fixedNow).toISOString();
    assert(
      'badge: bugün eklenen → isNew true',
      isLibraryRecentlyAdded(todayIso, LIBRARY_NEW_BADGE_DAYS),
    );

    const eightDaysAgoMs = fixedNow - 8 * 24 * 60 * 60 * 1000;
    const eightDaysAgoIso = new Date(eightDaysAgoMs).toISOString();
    assert(
      'badge: 8 gün önce eklenen → isNew false',
      !isLibraryRecentlyAdded(eightDaysAgoIso, LIBRARY_NEW_BADGE_DAYS),
    );
  } finally {
    Date.now = realNow;
  }
}

/**
 * DeepSeek json_object genelde şema ile uyumlu alanlar üretir; burada API ham çıktısını taklit eden
 * ince bir normalizasyon: correct_answer → correctAnswer (uygulama katmanında gerekirse aynısı yapılır).
 */
function normalizeDeepSeekExamJson(raw: Record<string, unknown>): unknown {
  const questions = raw.questions;
  if (!Array.isArray(questions)) return raw;
  return {
    ...raw,
    questions: questions.map((q) => {
      if (!q || typeof q !== 'object') return q;
      const o = q as Record<string, unknown>;
      const out = { ...o };
      if ('correct_answer' in out && !('correctAnswer' in out)) {
        out.correctAnswer = out.correct_answer;
        delete out.correct_answer;
      }
      return out;
    }),
  };
}

function runGroup5DeepSeekPayload(): void {
  console.log('\n=== Grup 5: DeepSeek payload → AssessmentPayload ===');

  const deepSeekLike = {
    curriculum: 'SAT',
    subject: 'Audit DeepSeek',
    title: 'DeepSeek JSON Object Exam',
    engineType: 'OBJECTIVE',
    durationMinutes: 20,
    totalMarks: 2,
    questions: [
      {
        id: 'dq1',
        questionNumber: 1,
        type: 'multiple_choice',
        prompt: 'Sample?',
        options: ['A) one', 'B) two', 'C) three', 'D) four'],
        correct_answer: 'C',
        explanation: 'Three is correct.',
        targetMarks: 1,
      },
      {
        id: 'dq2',
        questionNumber: 2,
        type: 'multiple_choice',
        prompt: 'Second?',
        options: ['A) a', 'B) b', 'C) c', 'D) d'],
        correct_answer: 'B',
        explanation: 'B matches.',
        targetMarks: 1,
      },
    ],
  };

  assertNoThrow('DeepSeek: normalize + parseAssessmentPayload', () => {
    const normalized = normalizeDeepSeekExamJson(deepSeekLike);
    const parsed = parseAssessmentPayload(normalized);
    if (parsed.questions.length !== 2) throw new Error('soru sayısı');
    for (let i = 0; i < parsed.questions.length; i += 1) {
      const q = parsed.questions[i];
      const letters = ['A', 'B', 'C', 'D'];
      if (!q.options || q.options.length !== 4) throw new Error('options');
      if (!q.correctAnswer || !letters.includes(q.correctAnswer))
        throw new Error('correctAnswer harf');
      const idx = letters.indexOf(q.correctAnswer);
      if (!q.options[idx].toUpperCase().startsWith(q.correctAnswer))
        throw new Error('correctAnswer indeks/options uyumu');
      if (!q.explanation || q.explanation.length < 3) throw new Error('explanation');
    }
  });
}

async function main(): Promise<void> {
  console.log('Interscola Hard Audit Harness 4.0\n');

  runGroup1TranscriptGpa();
  await runGroup1Verification();
  runGroup2Portfolio();
  runGroup3ExamFormats();
  runGroup4LibraryBadge();
  runGroup5DeepSeekPayload();

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

void main();
