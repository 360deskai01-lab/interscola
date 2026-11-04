/**
 * FAZ 1–4 + Test Et — Hard Audit Harness 3.1
 * Vitrin hub, asistan, yardım merkezi, test-et slug sözleşmesi (DB/HTTP yok).
 */
import {
  ADMIN_AVAILABLE_TIMES,
  buildSlot,
  getNextBusinessDays,
  type AdminTimeSlot,
} from '../src/components/assistant/assistant-scheduling';
import { matchFreeTextQuery } from '../src/components/assistant/assistant-content';
import {
  HELP_FAQ_ITEMS,
  faqMatchesCategory,
  faqMatchesSearch,
  normalizeSearchQuery,
  type HelpFaqItem,
} from '../src/app/help/help-content';
import {
  JOIN_CODE_LENGTH,
  JOIN_CODE_PATTERN,
  normalizeJoinCodeInput,
  generateRandomJoinCode,
} from '../src/lib/b2b/join-code';
import { parseAssessmentPayload } from '../src/lib/assessment-payload';
import {
  SOLUTION_TAB_IDS,
  isSolutionTabId,
  parseSolutionTab,
  solutionsTabHref,
} from '../src/lib/solutions/solution-tabs';
import { TEST_LINKS } from '../src/components/navigation/nav-config';
import { CAIE_ANDRADE_DIAGNOSTIC_EXAM } from '../src/lib/test-et/caie-andrade-seed';
import { scoreGuestDiagnostic } from '../src/lib/test-et/guest-diagnostic-scoring';
import { GUEST_DIAGNOSTIC_STORAGE_KEY } from '../src/lib/test-et/guest-diagnostic-storage';
import {
  TEST_ET_SLUGS,
  TEST_ET_VITRINE,
  curriculumForTestEtSlug,
  isTestEtSlug,
  testEtHref,
  type TestEtSlug,
} from '../src/lib/test-et/test-et-config';
import type { AssessmentPayload, CurriculumCode } from '../src/types/exam';

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

function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

function localDate(y: number, m: number, d: number): Date {
  const date = new Date(y, m, d, 18, 30, 0);
  date.setHours(12, 0, 0, 0);
  return date;
}

const EXPECTED_ADMIN_SLOTS: readonly AdminTimeSlot[] = [
  '10:00',
  '11:30',
  '14:00',
  '15:30',
  '17:00',
];

function runGroup1AssistantScheduling(): void {
  console.log('\n=== Grup 1: Asistan & takvim randevu sözleşmesi ===');

  assert(
    'ADMIN_AVAILABLE_TIMES: 5 resmi slot',
    ADMIN_AVAILABLE_TIMES.length === 5 &&
      EXPECTED_ADMIN_SLOTS.every((slot) =>
        (ADMIN_AVAILABLE_TIMES as readonly string[]).includes(slot),
      ),
  );

  const referenceDates = [
    { label: 'Cuma akşamı', date: localDate(2026, 10, 6) },
    { label: 'Pazar günü', date: localDate(2026, 10, 8) },
    { label: 'Yıl sonu', date: localDate(2026, 11, 31) },
  ];

  for (const ref of referenceDates) {
    const days = getNextBusinessDays(5, ref.date);
    assert(
      `getNextBusinessDays (${ref.label}): tam 5 iş günü`,
      days.length === 5,
    );
    assert(
      `getNextBusinessDays (${ref.label}): hafta sonu yok`,
      days.every((day) => !isWeekend(day)),
    );
    assert(
      `getNextBusinessDays (${ref.label}): artan takvim sırası`,
      days.every(
        (day, index) =>
          index === 0 || day.getTime() > days[index - 1]!.getTime(),
      ),
    );

    for (const day of days) {
      for (const time of ADMIN_AVAILABLE_TIMES) {
        const slot = buildSlot(day, time);
        assertNoThrow(
          `buildSlot (${ref.label}, ${slot.dateIso}, ${time})`,
          () => {
            if (!slot.dateIso || !slot.dateLabel || slot.time !== time) {
              throw new Error('Eksik slot alanı');
            }
          },
        );
      }
    }
  }
}

function keywordExpect(
  raw: string,
  expect: 'pricing' | 'exam_sat' | 'exam_ielts' | 'booking' | 'burs',
): boolean {
  const hit = matchFreeTextQuery(raw);
  if (!hit) return false;
  switch (expect) {
    case 'pricing':
      return hit.link?.href === '/pricing';
    case 'exam_sat':
      return hit.link?.href === '/sistem';
    case 'exam_ielts':
      return hit.link?.href === '/help';
    case 'booking':
      return hit.startBooking === true;
    case 'burs':
      return hit.link?.href === '/solutions?tab=burs';
    default:
      return false;
  }
}

function runGroup1AssistantKeywords(): void {
  const pricingVariants = ['fiyat', 'FİYAT', 'Ücret', 'ucret', '  PAKET  '];
  for (const q of pricingVariants) {
    assert(`matchFreeTextQuery pricing: "${q}"`, keywordExpect(q, 'pricing'));
  }

  assert('matchFreeTextQuery sat: "SAT"', keywordExpect('SAT', 'exam_sat'));
  assert('matchFreeTextQuery sat: "digital sat"', keywordExpect('digital sat', 'exam_sat'));

  assert('matchFreeTextQuery ielts: "IELTS"', keywordExpect('IELTS', 'exam_ielts'));
  assert('matchFreeTextQuery ielts: "Band 7"', keywordExpect('Band 7', 'exam_ielts'));

  const bookingVariants = ['randevu', 'RANDEVU', 'Görüşme', 'gorusme'];
  for (const q of bookingVariants) {
    assert(`matchFreeTextQuery booking: "${q}"`, keywordExpect(q, 'booking'));
  }

  const bursVariants = ['burs', 'BURS', 'Bursu', 'burslar'];
  for (const q of bursVariants) {
    assert(`matchFreeTextQuery burs: "${q}"`, keywordExpect(q, 'burs'));
  }
}

function runGroup2SolutionTabs(): void {
  console.log('\n=== Grup 2: Çözümler & sekme sözleşmesi ===');

  assert(
    'parseSolutionTab: bilinmeyen → ogrenci',
    parseSolutionTab('bilinmeyen') === 'ogrenci',
  );
  assert(
    'parseSolutionTab: null/undefined → ogrenci',
    parseSolutionTab(null) === 'ogrenci' &&
      parseSolutionTab(undefined) === 'ogrenci',
  );
  assert(
    'parseSolutionTab: boşluklu geçersiz',
    parseSolutionTab('  ???  ') === 'ogrenci',
  );

  assert(
    'SOLUTION_TAB_IDS: 5 resmi sekme',
    SOLUTION_TAB_IDS.length === 5,
  );

  const official: readonly string[] = [
    'ogrenci',
    'ogretmen',
    'kurum',
    'universite',
    'burs',
  ];
  for (const tab of official) {
    assert(
      `isSolutionTabId: "${tab}"`,
      isSolutionTabId(tab) && parseSolutionTab(tab) === tab,
    );
    assert(
      `solutionsTabHref: "${tab}"`,
      solutionsTabHref(tab as (typeof SOLUTION_TAB_IDS)[number]) ===
        `/solutions?tab=${tab}`,
    );
  }
}

function filterHelpFaqs(
  items: HelpFaqItem[],
  rawQuery: string,
  category: 'all' | 'student' | 'teacher' | 'org' | 'billing' = 'all',
): HelpFaqItem[] {
  const query = normalizeSearchQuery(rawQuery);
  return items.filter(
    (item) => faqMatchesCategory(item, category) && faqMatchesSearch(item, query),
  );
}

function runGroup3HelpCenter(): void {
  console.log('\n=== Grup 3: Yardım merkezi arama & SSS izolasyonu ===');

  assert(
    'HELP_FAQ_ITEMS: 10 kayıt',
    HELP_FAQ_ITEMS.length === 10,
  );

  for (const item of HELP_FAQ_ITEMS) {
    assert(
      `FAQ zorunlu alanlar: ${item.id}`,
      Boolean(item.id?.trim()) &&
        Array.isArray(item.categories) &&
        item.categories.length > 0 &&
        Boolean(item.question?.trim()) &&
        Boolean(item.answer?.trim()),
    );
  }

  const hostileQueries = [
    '',
    '   ',
    '[test',
    '*wildcard',
    '?single',
    'İLTŞ',
    'İELTS',
    'teşhis',
    '(regex)',
    '\\escape',
  ];

  for (const q of hostileQueries) {
    assertNoThrow(`faq filtresi güvenli: "${q}"`, () => {
      const result = filterHelpFaqs(HELP_FAQ_ITEMS, q);
      if (!Array.isArray(result)) {
        throw new Error('Dizi değil');
      }
    });
  }

  assert(
    'faq arama: İELTS eşleşmesi',
    filterHelpFaqs(HELP_FAQ_ITEMS, 'ielts').some((i) => i.id === 'ielts-scoring'),
  );
}

/** page.tsx ile aynı: geçersiz slug → notFound (404) yolu. */
function resolveTestEtSlugForRoute(raw: string): TestEtSlug | null {
  return isTestEtSlug(raw) ? raw : null;
}

function runGroup5TestEtVitrine(): void {
  console.log('\n=== Grup 5: Test Et vitrin slug & curriculum eşleşmesi ===');

  const slugCurriculum: Record<TestEtSlug, CurriculumCode> = {
    sat: 'SAT',
    ielts: 'IELTS',
    'a-level': 'CAIE',
  };

  assert(
    'TEST_ET_SLUGS: 3 resmi slug',
    TEST_ET_SLUGS.length === 3,
  );

  for (const slug of TEST_ET_SLUGS) {
    assert(
      `curriculumForTestEtSlug: ${slug}`,
      curriculumForTestEtSlug(slug) === slugCurriculum[slug],
    );
    assert(
      `testEtHref: ${slug}`,
      testEtHref(slug) === `/test-et/${slug}`,
    );
    assert(
      `TEST_ET_VITRINE: ${slug} içerik`,
      TEST_ET_VITRINE[slug].slug === slug &&
        TEST_ET_VITRINE[slug].measuredSkills.length > 0,
    );
  }

  const invalidSlugs = [
    '',
    'bilinmeyen',
    'SAT',
    'ielts-academic',
    'a_level',
    '../sat',
    'sat/extra',
  ];

  for (const bad of invalidSlugs) {
    assert(`isTestEtSlug reddi: "${bad}"`, !isTestEtSlug(bad));
    assert(
      `resolveTestEtSlugForRoute (404 yolu): "${bad}"`,
      resolveTestEtSlugForRoute(bad) === null,
    );
  }

  const navExamLinks = TEST_LINKS.filter((item) =>
    item.href.startsWith('/test-et/'),
  );

  assert(
    'TEST_LINKS: 3 test-et vitrin linki',
    navExamLinks.length === 3,
  );

  const expectedNav: { label: string; slug: TestEtSlug }[] = [
    { label: 'Digital SAT', slug: 'sat' },
    { label: 'IELTS Academic', slug: 'ielts' },
    { label: 'Cambridge CAIE A-Level', slug: 'a-level' },
  ];

  for (const expected of expectedNav) {
    const link = TEST_LINKS.find((item) => item.label === expected.label);
    assert(
      `TEST_LINKS "${expected.label}" mevcut`,
      Boolean(link),
    );
    assert(
      `TEST_LINKS "${expected.label}" href`,
      link?.href === testEtHref(expected.slug),
    );
  }

  assert(
    'CAIE Andrade statik fallback: curriculum CAIE',
    CAIE_ANDRADE_DIAGNOSTIC_EXAM.curriculum === 'CAIE',
  );
  assert(
    'CAIE Andrade statik fallback: exam_payload soruları',
    CAIE_ANDRADE_DIAGNOSTIC_EXAM.questions.length >= 3,
  );
  assert(
    'a-level slug → CAIE müfredat',
    curriculumForTestEtSlug('a-level') === 'CAIE',
  );

  assert(
    'GUEST_DIAGNOSTIC_STORAGE_KEY sabiti',
    GUEST_DIAGNOSTIC_STORAGE_KEY === 'interscola_guest_diagnostic',
  );

  const satExam = {
    curriculum: 'SAT' as const,
    subject: 'Audit SAT',
    title: 'Audit',
    engineType: 'OBJECTIVE' as const,
    durationMinutes: 15,
    totalMarks: 2,
    questions: [
      {
        id: 'q1',
        questionNumber: 1,
        type: 'multiple_choice' as const,
        prompt: 'P',
        options: ['A) 1', 'B) 2', 'C) 3', 'D) 4'],
        correctAnswer: 'B',
        targetMarks: 1,
      },
      {
        id: 'q2',
        questionNumber: 2,
        type: 'multiple_choice' as const,
        prompt: 'P2',
        options: ['A) 1', 'B) 2', 'C) 3', 'D) 4'],
        correctAnswer: 'A',
        targetMarks: 1,
      },
    ],
  };

  const satScored = scoreGuestDiagnostic({
    exam: satExam,
    answers: { q1: 'B', q2: 'A' },
    slug: 'sat',
  });
  assert(
    'scoreGuestDiagnostic SAT: tam doğru → 1600',
    satScored.headlineScore === '1600 / 1600',
  );

  const caieScored = scoreGuestDiagnostic({
    exam: CAIE_ANDRADE_DIAGNOSTIC_EXAM,
    answers: {
      'caie-andrade-mcq1': 'B',
      'caie-andrade-structured': 'Method one. Method two with enough words here.',
      'caie-andrade-essay':
        'Evaluation paragraph with sufficient length for partial credit scoring in guest mode.',
    },
    slug: 'a-level',
  });
  assert(
    'scoreGuestDiagnostic CAIE: headline Grade',
    caieScored.headlineScore.startsWith('Grade'),
  );
}

function runGroup4CoreRegression(): void {
  console.log('\n=== Grup 4: B2B & çekirdek kütüphane regresyonu ===');

  assert(
    'join-code: normalize + pattern',
    normalizeJoinCodeInput('abc-def') === 'ABCDEF' &&
      JOIN_CODE_PATTERN.test('234ABC') &&
      JOIN_CODE_LENGTH === 6,
  );

  const code = generateRandomJoinCode();
  assert(
    'join-code: generateRandomJoinCode sözleşmesi',
    code.length === JOIN_CODE_LENGTH && JOIN_CODE_PATTERN.test(code),
  );

  const minimalExam: AssessmentPayload = {
    curriculum: 'SAT',
    subject: 'Audit V3 Regression',
    title: 'Harness Exam',
    engineType: 'OBJECTIVE',
    durationMinutes: 15,
    totalMarks: 1,
    questions: [
      {
        id: 'audit-v3-q1',
        questionNumber: 1,
        type: 'multiple_choice',
        prompt: 'Placeholder',
        options: ['A) 1', 'B) 2', 'C) 3', 'D) 4'],
        correctAnswer: 'A',
        targetMarks: 1,
      },
    ],
  };

  assertNoThrow('parseAssessmentPayload: minimal OBJECTIVE SAT', () => {
    const parsed = parseAssessmentPayload(minimalExam);
    if (
      parsed.curriculum !== 'SAT' ||
      parsed.engineType !== 'OBJECTIVE' ||
      parsed.questions.length !== 1
    ) {
      throw new Error('Parse çıktısı beklenenden farklı');
    }
  });

  const payloadKeys = [
    'curriculum',
    'subject',
    'title',
    'engineType',
    'durationMinutes',
    'totalMarks',
    'questions',
  ] as const;

  assert(
    'AssessmentPayload: zorunlu üst alan anahtarları',
    payloadKeys.every((key) => key in minimalExam),
  );
}

function main(): void {
  console.log('Interscola Hard Audit Harness 3.1\n');

  runGroup1AssistantScheduling();
  runGroup1AssistantKeywords();
  runGroup2SolutionTabs();
  runGroup3HelpCenter();
  runGroup4CoreRegression();
  runGroup5TestEtVitrine();

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
