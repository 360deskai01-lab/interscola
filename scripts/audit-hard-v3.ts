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
import {
  computeSeatUsage,
  isOrganizationLicenseActive,
  isStudentQuotaExceeded,
  ORG_JOIN_QUOTA_FULL_MESSAGE,
} from '../src/lib/b2b/license-quota';
import {
  COORDINATOR_ELIGIBLE_ORG_ROLES,
  isCoordinatorEligibleOrgRole,
} from '../src/lib/b2b/coordinator-types';
import { parseAssessmentPayload } from '../src/lib/assessment-payload';
import {
  SOLUTION_TAB_IDS,
  isSolutionTabId,
  parseSolutionTab,
  solutionsTabHref,
} from '../src/lib/solutions/solution-tabs';
import {
  NAV_TEST_ET_BUDGET_HREF,
  NAV_TEST_ET_SCHOLARSHIP_HREF,
  TEST_LINKS,
} from '../src/components/navigation/nav-config';
import { BUDGET_CATALOG_SEED } from '../src/lib/budget-simulator/catalog-seed';
import {
  AUDIT_BUDGET_COMFORT_INPUT,
  AUDIT_BUDGET_TIGHT_INPUT,
  auditBudgetCatalogSize,
  evaluateBudgetSimulator,
} from '../src/lib/budget-simulator/evaluator';
import { getUniversityDisplayBadges } from '../src/lib/budget-simulator/university-enrichment';
import {
  GUEST_BUDGET_KEY,
  GUEST_DIAGNOSTIC_EXAM_KEY,
  GUEST_LEAD_TARGET_SCORES_KEY,
  GUEST_SCHOLARSHIP_KEY,
} from '../src/lib/guest-lead/constants';
import { mergeGuestLeadIntoTargetScores } from '../src/lib/guest-lead/merge-target-scores';
import {
  BIG_FIVE_DEEP_MODULE_READY,
  HOLLAND_DEEP_MODULE_READY,
  QUICK_RESULT_DEEPENING_INTRO,
} from '../src/lib/career-assessment/deep-module-readiness';
import { formatRiasecDominantCodes } from '../src/lib/career-assessment/teacher-snapshot-format';
import {
  BUDGET_REGISTER_HREF,
  BUDGET_SIMULATOR_PATH,
} from '../src/lib/budget-simulator/types';
import { SOLUTION_TABS } from '../src/app/solutions/solutions-content';
import {
  AUDIT_HIGH_NEED_INPUT,
  evaluateScholarshipSimulator,
} from '../src/lib/scholarship-simulator/evaluator';
import {
  SCHOLARSHIP_REGISTER_HREF,
  SCHOLARSHIP_SIMULATOR_PATH,
} from '../src/lib/scholarship-simulator/types';
import { CAIE_ANDRADE_DIAGNOSTIC_EXAM } from '../src/lib/test-et/caie-andrade-seed';
import { scoreGuestDiagnostic } from '../src/lib/test-et/guest-diagnostic-scoring';
import { GUEST_DIAGNOSTIC_STORAGE_KEY } from '../src/lib/test-et/guest-diagnostic-storage';
import {
  TEST_ET_SLUGS,
  TEST_ET_VITRINE,
  curriculumForTestEtSlug,
  isTestEtSlug,
  testEtHref,
  testEtSlugForCurriculum,
  type TestEtSlug,
} from '../src/lib/test-et/test-et-config';
import { getCaieGuestExamFallback } from '../src/lib/test-et/load-guest-diagnostic-exam';
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
    'TEST_LINKS: 5 test-et rotası',
    navExamLinks.length === 5,
  );

  const scholarshipNav = TEST_LINKS.find(
    (item) => item.href === NAV_TEST_ET_SCHOLARSHIP_HREF,
  );
  assert(
    'TEST_LINKS: Burs & Destek Simülatörü',
    scholarshipNav?.label === 'Burs & Destek Simülatörü' &&
      scholarshipNav.href === SCHOLARSHIP_SIMULATOR_PATH,
  );

  const budgetNav = TEST_LINKS.find(
    (item) => item.href === NAV_TEST_ET_BUDGET_HREF,
  );
  assert(
    'TEST_LINKS: Bütçe & Yaşam Maliyeti',
    budgetNav?.label === 'Bütçe & Yaşam Maliyeti' &&
      budgetNav.href === BUDGET_SIMULATOR_PATH,
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
    'TEST_LINKS: dashboard explore href yok',
    !TEST_LINKS.some((item) => item.href.includes('/student/dashboard')),
  );

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
    'CAIE müfredat → a-level slug',
    testEtSlugForCurriculum('CAIE') === 'a-level',
  );

  assert(
    'getCaieGuestExamFallback: Andrade payload',
    getCaieGuestExamFallback().questions.length >= 3 &&
      getCaieGuestExamFallback().curriculum === 'CAIE',
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

function runGroup6ScholarshipSimulator(): void {
  console.log('\n=== Grup 6: Burs simülatörü ===');

  assert(
    'SCHOLARSHIP_SIMULATOR_PATH sabiti',
    SCHOLARSHIP_SIMULATOR_PATH === '/test-et/scholarship',
  );
  assert(
    'SCHOLARSHIP_REGISTER_HREF sabiti',
    SCHOLARSHIP_REGISTER_HREF === '/auth/register?source=scholarship',
  );

  const bursTab = SOLUTION_TABS.find((tab) => tab.id === 'burs');
  assert(
    'Solutions burs sekmesi: simülatör CTA',
    bursTab?.ctaHref === SCHOLARSHIP_SIMULATOR_PATH &&
      bursTab.ctaLabel.includes('Burs İhtimalini'),
  );

  const highNeed = evaluateScholarshipSimulator(AUDIT_HIGH_NEED_INPUT);
  assert(
    'evaluateScholarshipSimulator: yüksek need bandı (DSU)',
    highNeed.needBasedScore >= 85 && highNeed.needBasedScore <= 100,
  );
  assert(
    'evaluateScholarshipSimulator: merit skoru aralığı',
    highNeed.meritBasedScore >= 0 && highNeed.meritBasedScore <= 100,
  );
  assert(
    'evaluateScholarshipSimulator: en az 2 eşleşme',
    highNeed.matches.length >= 2,
  );
  assert(
    'evaluateScholarshipSimulator: kilitli teaser alanları',
    highNeed.lockedTeaser.iseeDocumentList.length >= 3 &&
      highNeed.lockedTeaser.consulateApostilleNotes.length >= 2 &&
      highNeed.lockedTeaser.applicationCalendar.length >= 2,
  );
  assert(
    'evaluateScholarshipSimulator: İtalya DSU eşleşmesi',
    highNeed.matches.some((m) => m.id === 'italy-dsu'),
  );

  const lowNeedHighMerit = evaluateScholarshipSimulator({
    ...AUDIT_HIGH_NEED_INPUT,
    householdIncome: 'over_55k',
    propertyOwnership: 'multiple',
    studentsInFamily: '1',
    maxFamilyContribution: 'over_10k',
    highSchoolGpa: '90_plus',
    examStatus: 'sat_high',
    englishProficiency: 'ielts_7_plus',
  });
  assert(
    'evaluateScholarshipSimulator: düşük need / yüksek merit ayrımı',
    lowNeedHighMerit.needBasedScore < highNeed.needBasedScore &&
      lowNeedHighMerit.meritBasedScore > highNeed.meritBasedScore,
  );
}

function runGroup7BudgetSimulator(): void {
  console.log('\n=== Grup 7: Bütçe & yaşam maliyeti simülatörü ===');

  assert(
    'BUDGET_SIMULATOR_PATH sabiti',
    BUDGET_SIMULATOR_PATH === '/test-et/budget',
  );
  assert(
    'BUDGET_REGISTER_HREF sabiti',
    BUDGET_REGISTER_HREF === '/auth/register?source=budget',
  );
  assert(
    'BUDGET_CATALOG_SEED: en az 10 kayıt',
    auditBudgetCatalogSize() >= 10,
  );

  const uniTab = SOLUTION_TABS.find((tab) => tab.id === 'universite');
  assert(
    'Solutions üniversite sekmesi: bütçe simülatörü linki',
    uniTab?.secondaryCtaHref === BUDGET_SIMULATOR_PATH &&
      Boolean(uniTab.secondaryCtaLabel?.trim()),
  );

  const comfort = evaluateBudgetSimulator(AUDIT_BUDGET_COMFORT_INPUT);
  assert(
    'evaluateBudgetSimulator: rahat bütçede eşleşme',
    comfort.matchedUniversitiesCount >= 5 &&
      comfort.matchedCitiesCount >= 3 &&
      comfort.matchedCountriesCount >= 2,
  );
  assert(
    'evaluateBudgetSimulator: 2 örnek şehir kartı',
    comfort.sampleCities.length === 2,
  );
  assert(
    'evaluateBudgetSimulator: Aachen veya Bologna örnekleri',
    comfort.sampleCities.some(
      (c) =>
        c.city.toLowerCase().includes('aachen') ||
        c.city.toLowerCase().includes('bologna'),
    ),
  );
  assert(
    'evaluateBudgetSimulator: kilitli liste dolu',
    comfort.lockedUniversities.length === comfort.matchedUniversitiesCount &&
      comfort.accommodationTips.length >= 3,
  );

  const tight = evaluateBudgetSimulator(AUDIT_BUDGET_TIGHT_INPUT);
  assert(
    'evaluateBudgetSimulator: sıkı bütçe < rahat bütçe eşleşmesi',
    tight.matchedUniversitiesCount < comfort.matchedUniversitiesCount,
  );
  assert(
    'evaluateBudgetSimulator: sıkı bütçede en az 1 eşleşme',
    tight.matchedUniversitiesCount >= 1,
  );
  assert(
    'evaluateBudgetSimulator: part-time ipucu hapı',
    Boolean(comfort.partTimeInsightPill?.includes('€450')),
  );
  assert(
    'evaluateBudgetSimulator: örnek kart part-time rozeti',
    comfort.sampleCities.every((c) => Boolean(c.partTimeWork?.trim())),
  );

  const rwth = BUDGET_CATALOG_SEED.find((e) => e.slug === 'rwth-aachen');
  assert(
    'BUDGET_CATALOG_SEED: Almanya part-time metni',
    Boolean(rwth?.partTimeWork?.includes('Minijob')),
  );
  const bocconi = BUDGET_CATALOG_SEED.find(
    (e) => e.slug === 'bocconi-university',
  );
  assert(
    'BUDGET_CATALOG_SEED: Bocconi çift diploma rozeti',
    Boolean(bocconi?.specialProgram?.includes('Çift Diploma')),
  );
  const badges = getUniversityDisplayBadges('tu-munich', 'Almanya');
  assert(
    'getUniversityDisplayBadges: TUM özel program',
    Boolean(badges.specialProgram?.includes('TUM')),
  );
}

function runGroup8GuestLeadClaim(): void {
  console.log('\n=== Grup 8: Misafir simülasyon claim köprüsü ===');

  assert(
    'GUEST_SCHOLARSHIP_KEY sabiti',
    GUEST_SCHOLARSHIP_KEY === 'interscola_guest_scholarship',
  );
  assert(
    'GUEST_BUDGET_KEY sabiti',
    GUEST_BUDGET_KEY === 'interscola_guest_budget',
  );
  assert(
    'GUEST_DIAGNOSTIC_EXAM_KEY sabiti',
    GUEST_DIAGNOSTIC_EXAM_KEY === 'interscola_guest_exam',
  );
  assert(
    'GUEST_LEAD_TARGET_SCORES_KEY sabiti',
    GUEST_LEAD_TARGET_SCORES_KEY === '_guestLead',
  );

  const merged = mergeGuestLeadIntoTargetScores(
    { SAT: 1400 },
    {
      scholarship: {
        v: 1,
        savedAt: '2026-01-01T00:00:00.000Z',
        input: {
          targetCountry: 'italy',
          householdIncome: 'under_15k',
          propertyOwnership: 'rent',
          studentsInFamily: '2',
          maxFamilyContribution: 'under_2k',
          highSchoolGpa: '80_90',
          examStatus: 'sat_mid',
          englishProficiency: 'ielts_6',
        },
        needBasedScore: 88,
        meritBasedScore: 55,
        summaryParagraph: 'Audit özeti',
        matchIds: ['italy-dsu'],
      },
    },
  );

  assert(
    'mergeGuestLeadIntoTargetScores: SAT korunur',
    merged.SAT === 1400,
  );
  const lead = merged[GUEST_LEAD_TARGET_SCORES_KEY] as {
    scholarship?: { needBasedScore?: number };
    claimedAt?: string;
  };
  assert(
    'mergeGuestLeadIntoTargetScores: burs verisi yazılır',
    lead?.scholarship?.needBasedScore === 88 && Boolean(lead.claimedAt),
  );
}

function runGroup9CareerCompassBridge(): void {
  console.log('\n=== Grup 9: Kariyer pusulası öğretmen & derinleştirme ===');

  assert(
    'formatRiasecDominantCodes: R-I-A',
    formatRiasecDominantCodes(['R', 'I', 'A']) === 'R-I-A',
  );
  assert(
    'QUICK_RESULT_DEEPENING_INTRO metni',
    QUICK_RESULT_DEEPENING_INTRO.includes('Standart sapmayı'),
  );
  assert(
    'HOLLAND_DEEP_MODULE_READY',
    HOLLAND_DEEP_MODULE_READY === true,
  );
  assert(
    'BIG_FIVE_DEEP_MODULE_READY',
    BIG_FIVE_DEEP_MODULE_READY === true,
  );
}

function runGroup10B2BLicenseQuota(): void {
  console.log('\n=== Grup 10: B2B kota savunması & koordinatör bağlamı ===');

  const future = new Date('2030-01-01T00:00:00.000Z');
  const past = new Date('2020-01-01T00:00:00.000Z');

  assert(
    'license: aktif kurum (valid_until gelecek)',
    isOrganizationLicenseActive(true, future.toISOString(), future),
  );
  assert(
    'license: süresi dolmuş kurum',
    !isOrganizationLicenseActive(true, past.toISOString(), future),
  );
  assert(
    'license: is_active false',
    !isOrganizationLicenseActive(false, future.toISOString(), future),
  );

  assert(
    'quota: seatsUsed >= student_quota → dolu',
    isStudentQuotaExceeded(50, 50) && !isStudentQuotaExceeded(49, 50),
  );
  assert(
    'quota: null kota → sınırsız',
    !isStudentQuotaExceeded(9999, null),
  );
  assert(
    'quota: ORG_JOIN_QUOTA_FULL_MESSAGE metni',
    ORG_JOIN_QUOTA_FULL_MESSAGE.includes('lisans kotası'),
  );

  const usage = computeSeatUsage(40, 50);
  assert(
    'computeSeatUsage: kalan ve yüzde',
    usage.seatsRemaining === 10 &&
      usage.usagePercent === 80 &&
      !usage.isQuotaFull,
  );
  assert(
    'computeSeatUsage: kota dolu bayrağı',
    computeSeatUsage(50, 50).isQuotaFull,
  );

  assert(
    'coordinator: org_admin uygun rol',
    isCoordinatorEligibleOrgRole('org_admin'),
  );
  assert(
    'coordinator: teacher uygun değil',
    !isCoordinatorEligibleOrgRole('teacher'),
  );
  assert(
    'COORDINATOR_ELIGIBLE_ORG_ROLES: coordinator + org_admin + school_admin',
    COORDINATOR_ELIGIBLE_ORG_ROLES.includes('coordinator') &&
      COORDINATOR_ELIGIBLE_ORG_ROLES.includes('org_admin') &&
      COORDINATOR_ELIGIBLE_ORG_ROLES.includes('school_admin'),
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
  runGroup6ScholarshipSimulator();
  runGroup7BudgetSimulator();
  runGroup8GuestLeadClaim();
  runGroup9CareerCompassBridge();
  runGroup10B2BLicenseQuota();

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
