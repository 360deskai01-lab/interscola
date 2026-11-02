/**
 * FAZ 7 & 8 — Hard Audit Harness 2.0
 * Saf birim mantığı; DB veya HTTP gerektirmez.
 */
import {
  JOIN_CODE_CHARSET,
  JOIN_CODE_LENGTH,
  JOIN_CODE_PATTERN,
  formatJoinCodeDisplay,
  formatJoinCodeFieldInput,
  generateRandomJoinCode,
  normalizeJoinCodeInput,
} from '../src/lib/b2b/join-code';
import {
  hashNormalizedSourceContent,
  hashSourceHtml,
  normalizeSourceHtml,
} from '../src/lib/intelligence/source-hash';
import {
  isOfficialCompletedAttempt,
  type OfficialAttemptRow,
} from '../src/lib/student-command-center/official-attempts';
import {
  parseTargetNumber,
  scoreGapProgress,
} from '../src/lib/student-command-center/score-gap';
import { computeUniversityMatchBadge } from '../src/lib/student-command-center/university-match';
import type {
  StudentLatestScores,
  University,
} from '../src/lib/universities/types';

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

function mockUniversity(
  overrides: Partial<University> & Pick<University, 'min_sat_score' | 'min_ielts_band'>,
): University {
  return {
    id: 'audit-uni',
    slug: 'audit-uni',
    name: 'Audit University',
    country: 'Test',
    city: null,
    min_alevel: null,
    min_gpa: null,
    tuition_fee_range: null,
    monthly_living_cost: null,
    accommodation_info: null,
    application_deadlines: null,
    description: null,
    scholarship_info: null,
    local_exam_requirements: null,
    website_url: null,
    logo_url: null,
    cover_image_url: null,
    ...overrides,
  };
}

/** intelligence-actions ile aynı uyarı eşiği mantığı. */
function wouldCreateIntelligenceAlert(
  previousHash: string | null,
  newHash: string,
): boolean {
  const previous = previousHash?.trim() || null;
  return previous !== null && previous.length > 0 && previous !== newHash;
}

function runGroup1JoinCode(): void {
  console.log('\n=== Grup 1: B2B Join Code Motoru ===');

  assert(
    'normalizeJoinCodeInput: 0/O/1/I karakterleri elenir',
    normalizeJoinCodeInput('A0O1B2C3') === 'AB2C3',
  );

  assert(
    'normalizeJoinCodeInput: tire ve boşluk elenir',
    normalizeJoinCodeInput('  ab-c2d3e4  ') === 'ABC2D3E4',
  );

  const normalizedDash = normalizeJoinCodeInput('ABC-DEF');
  assert(
    'normalizeJoinCodeInput: geçerli 6 karakter korunur',
    normalizedDash === 'ABCDEF' && JOIN_CODE_PATTERN.test(normalizedDash),
  );

  assert(
    'formatJoinCodeFieldInput: özel karakterleri süzer',
    formatJoinCodeFieldInput('ab@#c!') === 'ABC',
  );

  assert(
    'formatJoinCodeDisplay: ABC123 görüntü formatı (geçerli charset)',
    formatJoinCodeDisplay('234ABC') === '234-ABC',
  );

  const generated = generateRandomJoinCode();
  assert(
    'generateRandomJoinCode: uzunluk ve charset',
    generated.length === JOIN_CODE_LENGTH &&
      JOIN_CODE_PATTERN.test(generated) &&
      [...generated].every((ch) => JOIN_CODE_CHARSET.includes(ch)),
  );
}

function runGroup2ScoreRadar(): void {
  console.log('\n=== Grup 2: Skor Radarı & Üniversite Eşleşmesi ===');

  const below = scoreGapProgress(1200, 1400);
  assert(
    'scoreGapProgress: hedef altı kalan ve yüzde',
    below.percent === 86 && below.remaining === 200 && below.exceeded === false,
  );

  const exact = scoreGapProgress(1400, 1400);
  assert(
    'scoreGapProgress: sınırda hedef yakalandı',
    exact.percent === 100 && exact.remaining === 0 && exact.exceeded === true,
  );

  const above = scoreGapProgress(1500, 1400);
  assert(
    'scoreGapProgress: hedef üstü exceeded',
    above.percent === 100 && above.exceeded === true,
  );

  assert(
    'parseTargetNumber: string hedef parse',
    parseTargetNumber('7.5') === 7.5 && parseTargetNumber(undefined) === null,
  );

  const uni = mockUniversity({ min_sat_score: 1400, min_ielts_band: 7.0 });
  const metScores: StudentLatestScores = {
    satScore: 1450,
    ieltsBand: 7.5,
    caieGrade: null,
  };
  assert(
    'computeUniversityMatchBadge: barajların üstü → met',
    computeUniversityMatchBadge(uni, metScores) === 'met',
  );

  const gapScores: StudentLatestScores = {
    satScore: 1300,
    ieltsBand: 7.5,
    caieGrade: null,
  };
  assert(
    'computeUniversityMatchBadge: SAT altı → gap',
    computeUniversityMatchBadge(uni, gapScores) === 'gap',
  );

  const pendingScores: StudentLatestScores = {
    satScore: null,
    ieltsBand: 7.5,
    caieGrade: null,
  };
  assert(
    'computeUniversityMatchBadge: eksik skor → insufficient_data',
    computeUniversityMatchBadge(uni, pendingScores) === 'insufficient_data',
  );
}

function runGroup3OfficialAttempts(): void {
  console.log('\n=== Grup 3: Resmi Deneme Filtre Mantığı ===');

  const examIds = new Set<string>(['exam-assignment-1']);

  const draftRow: OfficialAttemptRow = {
    raw_score: null,
    scaled_result: 'ok',
    assignment_id: 'exam-assignment-1',
  };
  assert(
    'isOfficialCompletedAttempt: raw_score yok → elenir',
    isOfficialCompletedAttempt(draftRow, examIds) === false,
  );

  const wrongAssignment: OfficialAttemptRow = {
    raw_score: 1200,
    scaled_result: '1200',
    assignment_id: 'practice-assignment',
  };
  assert(
    'isOfficialCompletedAttempt: exam olmayan atama → elenir',
    isOfficialCompletedAttempt(wrongAssignment, examIds) === false,
  );

  const officialAssigned: OfficialAttemptRow = {
    raw_score: 1350,
    scaled_result: '1350',
    assignment_id: 'exam-assignment-1',
  };
  assert(
    'isOfficialCompletedAttempt: exam ataması + raw_score → geçer',
    isOfficialCompletedAttempt(officialAssigned, examIds) === true,
  );

  const legacyUnassigned: OfficialAttemptRow = {
    raw_score: 8,
    scaled_result: 'Band 8.0',
    assignment_id: null,
  };
  assert(
    'isOfficialCompletedAttempt: atamasız ama scaled_result dolu → geçer',
    isOfficialCompletedAttempt(legacyUnassigned, examIds) === true,
  );

  const legacyEmptyScaled: OfficialAttemptRow = {
    raw_score: 8,
    scaled_result: '   ',
    assignment_id: undefined,
  };
  assert(
    'isOfficialCompletedAttempt: atamasız ve scaled boş → elenir',
    isOfficialCompletedAttempt(legacyEmptyScaled, examIds) === false,
  );
}

function runGroup4IntelligenceHash(): void {
  console.log('\n=== Grup 4: İstihbarat SHA-256 Motoru ===');

  const noisy = `
    <html><head><style>.x{}</style></head>
    <body><!-- comment --><script>alert(1)</script>
    <p>  Admissions   requirements  </p></body></html>`;
  const normalized = normalizeSourceHtml(noisy);
  assert(
    'normalizeSourceHtml: script/style/comment ve whitespace temizlenir',
    !normalized.includes('<script') &&
      !normalized.includes('comment') &&
      normalized.includes('Admissions requirements'),
  );

  const htmlA = '<div>Min SAT 1400</div>';
  const hashA1 = hashSourceHtml(htmlA);
  const hashA2 = hashSourceHtml(htmlA);
  assert(
    'hashSourceHtml: deterministik aynı girdi → aynı hash',
    hashA1 === hashA2 && hashA1.length === 64,
  );

  const htmlB = '<div>Min SAT 1450</div>';
  const hashB = hashSourceHtml(htmlB);
  assert(
    'hashSourceHtml: içerik değişince hash değişir',
    hashB !== hashA1,
  );

  assert(
    'hashNormalizedSourceContent: bilinen vektör uzunluğu',
    hashNormalizedSourceContent('baseline-content').length === 64,
  );

  assert(
    'baseline: ilk hash (null) → uyarı oluşturulmaz',
    wouldCreateIntelligenceAlert(null, hashA1) === false,
  );

  assert(
    'baseline: aynı hash → uyarı oluşturulmaz',
    wouldCreateIntelligenceAlert(hashA1, hashA1) === false,
  );

  assert(
    'change: farklı hash → uyarı oluşturulur',
    wouldCreateIntelligenceAlert(hashA1, hashB) === true,
  );
}

function main(): void {
  console.log('Interscola Hard Audit Harness 2.0\n');

  runGroup1JoinCode();
  runGroup2ScoreRadar();
  runGroup3OfficialAttempts();
  runGroup4IntelligenceHash();

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
