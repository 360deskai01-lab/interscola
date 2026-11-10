/**
 * Hard Audit Harness 6.0 — B2B kota, admin geçişi, misafir claim, kurumsal A4 (DB/HTTP yok).
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveCoordinatorOrganizationAccess } from '../src/lib/b2b/coordinator-org-access';
import { computeCoordinatorReportSealServer } from '../src/lib/b2b/coordinator-report-seal-server';
import {
  buildTeacherQuotaSnapshot,
  resolveTeacherQuota,
} from '../src/lib/b2b/teacher-quota';
import {
  extractWeaknessTopicsFromEvaluation,
  topWeaknessTopics,
} from '../src/lib/b2b/weakness-ledger-topics';
import { orgJoinTeacherQuotaFullMessage } from '../src/lib/b2b/license-quota';
import { OBSERVER_INVALID_TOKEN_ERROR } from '../src/lib/observer/observer-dashboard-types';
import {
  countActiveStudentObserverTokens,
  MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI,
  OBSERVER_MAX_ACTIVE_TOKENS,
  shouldRejectObserverTokenCreation,
} from '../src/lib/observer/observer-token-limits';
import {
  calculateCaieGrade,
  normalizeCaieBreakdown,
  validateCaieQuestionRubric,
} from '../src/lib/exam/caie-rubric';
import { GUEST_DIAGNOSTIC_RESULT_KEY } from '../src/lib/guest-lead/constants';
import {
  buildGuestDiagnosticClaimPayload,
  GUEST_DIAGNOSTIC_CLAIM_SCHEMA_VERSION,
} from '../src/lib/test-et/guest-diagnostic-claim';
import { parseGuestDiagnosticClaimPayload } from '../src/lib/test-et/guest-diagnostic-claim-storage';
import type { GuestDiagnosticRecord } from '../src/lib/test-et/guest-diagnostic-storage';
import type { AssessmentPayload } from '../src/types/exam';

const ROOT = resolve(__dirname, '..');

const SAMPLE_ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SAMPLE_ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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

function readSrc(relativePath: string): string {
  const abs = resolve(ROOT, relativePath);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : '';
}

function runGroup1TeacherQuota(): void {
  console.log('\n=== Grup 1: Savunmacı öğretmen kotası ===');

  assert(
    'quota: açık teacher_quota=25 → 25',
    resolveTeacherQuota(25, 100) === 25,
  );
  assert(
    'quota: teacher_quota null, student_quota 100 → 10',
    resolveTeacherQuota(null, 100) === 10,
  );
  assert(
    'quota: teacher_quota null, student_quota 250 → 25',
    resolveTeacherQuota(undefined, 250) === 25,
  );
  assert(
    'quota: student_quota 20 → taban 10 (max(10, ceil(2)))',
    resolveTeacherQuota(null, 20) === 10,
  );
  assert(
    'quota: student_quota 0 → taban 10',
    resolveTeacherQuota(null, 0) === 10,
  );

  const atCapacity = buildTeacherQuotaSnapshot(10, null, 100);
  assert(
    'snapshot: dolu kota isFull=true',
    atCapacity.isFull === true && atCapacity.isOverQuota === false,
  );

  const over = buildTeacherQuotaSnapshot(11, 10, null);
  assert(
    'snapshot: aşım isOverQuota=true',
    over.isOverQuota === true && over.isFull === true,
  );

  const under = buildTeacherQuotaSnapshot(3, 10, null);
  assert(
    'snapshot: altında isFull=false',
    under.isFull === false && under.isOverQuota === false,
  );
}

function runGroup2AdminOrgAccess(): void {
  console.log('\n=== Grup 2: Admin kurum seçici & yetki izolasyonu ===');

  const coordinatorOwn = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: false,
    membershipOrganizationId: SAMPLE_ORG_A,
    requestedOrganizationId: SAMPLE_ORG_A,
  });
  assert(
    'access: koordinatör kendi orgId → izin',
    coordinatorOwn.allowed === true &&
      coordinatorOwn.allowed &&
      coordinatorOwn.organizationId === SAMPLE_ORG_A,
  );

  const coordinatorForeign = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: false,
    membershipOrganizationId: SAMPLE_ORG_A,
    requestedOrganizationId: SAMPLE_ORG_B,
  });
  assert(
    'access: koordinatör yabancı orgId → red',
    !coordinatorForeign.allowed &&
      coordinatorForeign.allowed === false &&
      coordinatorForeign.code === 'foreign_organization',
  );

  const coordinatorDefault = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: false,
    membershipOrganizationId: SAMPLE_ORG_A,
  });
  assert(
    'access: koordinatör istek yok → üyelik org',
    coordinatorDefault.allowed === true &&
      coordinatorDefault.organizationId === SAMPLE_ORG_A,
  );

  const adminSwitch = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: true,
    membershipOrganizationId: null,
    requestedOrganizationId: SAMPLE_ORG_B,
  });
  assert(
    'access: admin orgId parametresi → izin',
    adminSwitch.allowed === true &&
      adminSwitch.organizationId === SAMPLE_ORG_B,
  );

  const adminInvalid = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: true,
    membershipOrganizationId: null,
    requestedOrganizationId: 'not-a-uuid',
  });
  assert(
    'access: admin geçersiz orgId → üyelik yok',
    !adminInvalid.allowed && adminInvalid.code === 'no_membership',
  );
}

function satAuditExam(): AssessmentPayload {
  return {
    curriculum: 'SAT',
    subject: 'Audit SAT',
    title: 'Audit Guest SAT',
    engineType: 'OBJECTIVE',
    durationMinutes: 8,
    totalMarks: 2,
    questions: [
      {
        id: 'q1',
        questionNumber: 1,
        type: 'multiple_choice',
        prompt: 'Audit 1',
        options: ['A) 1', 'B) 2'],
        correctAnswer: 'A',
        targetMarks: 1,
      },
      {
        id: 'q2',
        questionNumber: 2,
        type: 'multiple_choice',
        prompt: 'Audit 2',
        options: ['A) 1', 'B) 2'],
        correctAnswer: 'B',
        targetMarks: 1,
      },
    ],
  };
}

function runGroup3GuestClaim(): void {
  console.log('\n=== Grup 3: Misafir teşhis claim sözleşmesi ===');

  assert(
    'guest: GUEST_DIAGNOSTIC_RESULT_KEY sabiti',
    GUEST_DIAGNOSTIC_RESULT_KEY === 'interscola_guest_diagnostic_result',
  );

  const record: GuestDiagnosticRecord = {
    slug: 'sat',
    curriculum: 'SAT',
    headlineScore: 'SAT 1200',
    summary: 'Audit özet',
    answers: { q1: 'A', q2: 'A' },
    completedAt: new Date('2026-03-01T12:00:00.000Z').toISOString(),
    is_timed_out: false,
    lockedTeaser: {
      questionBreakdown: [],
      rubricBreakdown: [],
      weakTopics: [],
    },
  };

  const payload = buildGuestDiagnosticClaimPayload(satAuditExam(), record);
  assert(
    'guest: claim schema version',
    payload.version === GUEST_DIAGNOSTIC_CLAIM_SCHEMA_VERSION,
  );
  assert(
    'guest: SAT 1/2 → scaled raw aralığı 1200–1600',
    payload.rawScore >= 1200 && payload.maxScore === 1600,
  );
  assert(
    'guest: studentAnswers korunur',
    payload.studentAnswers.q1 === 'A' && payload.studentAnswers.q2 === 'A',
  );

  const serialized = JSON.stringify(payload);
  const parsed = parseGuestDiagnosticClaimPayload(serialized);
  assert(
    'guest: storage round-trip parse',
    parsed !== null && parsed.examTitle === 'Audit Guest SAT',
  );

  const claimActions = readSrc('src/app/student/claim-guest-actions.ts');
  assert(
    'guest: origin_type diagnostic_claim yazımı',
    claimActions.includes("origin_type: 'diagnostic_claim'"),
  );
}

function runGroup4InstitutionalA4(): void {
  console.log('\n=== Grup 4: Kurumsal A4 rapor mührü ===');

  const orgId = SAMPLE_ORG_A;
  const day = '2026-03-09T15:00:00.000Z';
  const seal1 = computeCoordinatorReportSealServer(orgId, day);
  const seal2 = computeCoordinatorReportSealServer(orgId, day);
  assert('a4: mühür deterministik', seal1 === seal2);
  assert('a4: mühür ISL- öneki', seal1.startsWith('ISL-') && seal1.length > 10);

  const otherDay = computeCoordinatorReportSealServer(
    orgId,
    '2026-03-10T08:00:00.000Z',
  );
  assert('a4: farklı gün → farklı mühür', otherDay !== seal1);

  const reportActions = readSrc('src/app/coordinator/coordinator-report-actions.ts');
  assert(
    'a4: getCoordinatorSchoolReportDataAction tanımlı',
    reportActions.includes('getCoordinatorSchoolReportDataAction'),
  );

  const a4 = readSrc('src/components/coordinator/CoordinatorSchoolA4Report.tsx');
  assert(
    'a4: Institutional Report antet metni',
    a4.includes('Interscola Institutional Report'),
  );
  assert(
    'a4: print-color-adjust sözleşmesi',
    a4.includes('printColorAdjust') || a4.includes('print-color-adjust'),
  );
}

function runGroup5WeaknessLedger(): void {
  console.log('\n=== Grup 5: Weakness Ledger özeti ===');

  const topics = extractWeaknessTopicsFromEvaluation({
    remedialTopics: ['İkinci dereceden denklem', 'Paragraf ana fikri'],
    weakness_ledger: [
      { topic: 'İkinci dereceden denklem' },
      'Paragraf ana fikri',
      'Kelime dağarcığı',
    ],
  });
  assert(
    'weakness: ledger + remedial birleşimi',
    topics.length >= 3 &&
      topics.includes('Kelime dağarcığı') &&
      topics.includes('Paragraf ana fikri'),
  );

  const counts = new Map<string, number>([
    ['Cümle tamamlama', 12],
    ['Grafik okuma', 8],
    ['Ana fikir', 5],
  ]);
  const top = topWeaknessTopics(counts, 3);
  assert(
    'weakness: top-3 sıralama',
    top.length === 3 && top[0].topic === 'Cümle tamamlama' && top[0].occurrenceCount === 12,
  );

  const analyticsSrc = readSrc('src/lib/b2b/coordinator-school-report-analytics.ts');
  assert(
    'weakness: kurumsal rapor topWeaknessTopics(3)',
    analyticsSrc.includes('topWeaknessTopics(topicCounts, 3)'),
  );
}

const OBSERVER_HEX_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

function runGroup6ObserverTeacherContracts(): void {
  console.log('\n=== Grup 6: Observer token & öğretmen katılım sözleşmesi ===');

  const sampleToken = randomBytes(16).toString('hex');
  assert(
    'observer: 32 hex token üretimi regex',
    sampleToken.length === 32 && OBSERVER_HEX_TOKEN_PATTERN.test(sampleToken),
  );

  assert(
    'observer: GEÇERSİZ_VEYA_SÜRESİ_DOLMUŞ_BAĞLANTI sabiti',
    OBSERVER_INVALID_TOKEN_ERROR === 'GEÇERSİZ_VEYA_SÜRESİ_DOLMUŞ_BAĞLANTI',
  );

  const quotaMsg = orgJoinTeacherQuotaFullMessage(10, 10);
  assert(
    'teacher-join: orgJoinTeacherQuotaFullMessage (used/quota)',
    quotaMsg.includes('(10/10)') &&
      quotaMsg.includes('öğretmen lisans kapasitesi dolmuştur'),
  );

  const migration = readSrc(
    'supabase/migrations/20261109150000_student_observer_tokens.sql',
  );
  assert(
    'observer: student_observer_tokens tablo migration',
    migration.includes('CREATE TABLE') &&
      migration.includes('student_observer_tokens'),
  );
  assert(
    'observer: token_format CHECK 32 hex',
    migration.includes("token ~ '^[a-f0-9]{32}$'"),
  );

  const observerActions = readSrc('src/app/student/observer-actions.ts');
  assert(
    'observer: createObserverTokenAction tanımlı',
    observerActions.includes('createObserverTokenAction'),
  );
  assert(
    'observer: randomBytes(16).toString(\'hex\')',
    observerActions.includes("randomBytes(16).toString('hex')"),
  );

  assert(
    'observer: OBSERVER_MAX_ACTIVE_TOKENS = 5',
    OBSERVER_MAX_ACTIVE_TOKENS === 5,
  );

  assert(
    'observer: MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI sabiti',
    MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI ===
      'MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI',
  );

  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const mockFiveActive = Array.from({ length: 5 }, () => ({
    isActive: true,
    expiresAt: future,
  }));
  assert(
    'observer: 5 aktif token → üretim reddi',
    countActiveStudentObserverTokens(mockFiveActive) === 5 &&
      shouldRejectObserverTokenCreation(5) === true,
  );

  const mockFourActive = mockFiveActive.slice(0, 4);
  assert(
    'observer: 4 aktif token → üretim izinli',
    countActiveStudentObserverTokens(mockFourActive) === 4 &&
      shouldRejectObserverTokenCreation(4) === false,
  );

  assert(
    'observer: createObserverTokenAction limit kontrolü',
    observerActions.includes('shouldRejectObserverTokenCreation') &&
      observerActions.includes(MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI),
  );
}

function runGroup7CaieRubric(): void {
  console.log(
    '\n=== Grup 7: CAIE A-LEVEL / AS-LEVEL RUBRİK VE NOTLANDIRMA SÖZLEŞMESİ ===',
  );

  assert(
    'caie-grade: %90 A*, %80 A, %70 B, %40 E, %39 U',
    calculateCaieGrade(90, 100) === 'A*' &&
      calculateCaieGrade(80, 100) === 'A' &&
      calculateCaieGrade(70, 100) === 'B' &&
      calculateCaieGrade(40, 100) === 'E' &&
      calculateCaieGrade(39, 100) === 'U',
  );

  const breakdown = normalizeCaieBreakdown(10, 4, 2, 20);
  assert(
    'caie-breakdown: toplam ve cambridge_grade bütünlüğü',
    breakdown.totalScore === 16 &&
      breakdown.maxMarks === 20 &&
      breakdown.cambridge_grade === 'A' &&
      breakdown.percent === 80,
  );

  assert(
    'caie-breakdown: AO yüzde dağılımı toplamı ~100',
    Math.abs(
      breakdown.ao1Percent + breakdown.ao2Percent + breakdown.ao3Percent - 100,
    ) < 0.01,
  );

  assert(
    'caie-rubric: validate — en az bir AO kriteri (pozitif)',
    validateCaieQuestionRubric({
      ao2_application: 'Apply theories to the scenario.',
    }),
  );

  assert(
    'caie-rubric: validate — boş rubrik reddi',
    !validateCaieQuestionRubric({}) &&
      !validateCaieQuestionRubric(null) &&
      !validateCaieQuestionRubric({ ao1_knowledge: '   ' }),
  );
}

function main(): void {
  console.log('Interscola Hard Audit Harness 6.0\n');
  runGroup1TeacherQuota();
  runGroup2AdminOrgAccess();
  runGroup3GuestClaim();
  runGroup4InstitutionalA4();
  runGroup5WeaknessLedger();
  runGroup6ObserverTeacherContracts();
  runGroup7CaieRubric();

  console.log('\n--- Özet ---');
  console.log(`Toplam assertion: ${passed + failed}`);
  console.log(`Geçen: ${passed}`);
  console.log(`Kalan: ${failed}`);
  if (failed > 0) {
    console.error('\nAudit FAILED — başarısız kontroller var.');
    process.exit(1);
  }
  console.log('\nAudit PASSED — tüm kontroller [PASS].');
}

main();
