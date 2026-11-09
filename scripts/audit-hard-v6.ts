/**
 * Hard Audit Harness 6.0 — B2B kota, admin geçişi, misafir claim, kurumsal A4 (DB/HTTP yok).
 */
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

function main(): void {
  console.log('Interscola Hard Audit Harness 6.0\n');
  runGroup1TeacherQuota();
  runGroup2AdminOrgAccess();
  runGroup3GuestClaim();
  runGroup4InstitutionalA4();
  runGroup5WeaknessLedger();

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
