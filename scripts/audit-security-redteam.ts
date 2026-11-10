/**
 * Red-Team Güvenlik Denetimi — harici HTTP/DB yok; sözleşme ve deterministik simülasyon.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveCoordinatorOrganizationAccess } from '../src/lib/b2b/coordinator-org-access';
import {
  MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI,
  OBSERVER_MAX_ACTIVE_TOKENS,
  shouldRejectObserverTokenCreation,
} from '../src/lib/observer/observer-token-limits';

const ROOT = resolve(__dirname, '..');
const HEX_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

const SAMPLE_ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SAMPLE_ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const OBSERVER_VIEW_ALLOWED_KEYS = new Set([
  'studentDisplayName',
  'targetExamKey',
  'targetExamLabel',
  'targetScoreLabel',
  'currentLevelLabel',
  'attemptCount',
  'overallSuccessPercent',
  'attemptHistory',
  'timeline',
  'topWeaknessTopics',
  'generatedAt',
]);

const OBSERVER_LEAK_DENYLIST = [
  'password',
  'password_hash',
  'hashed',
  'service_role',
  'access_token',
  'refresh_token',
  'student_id',
  'observer_link_token',
  'email',
  'phone',
  'api_key',
  'secret',
] as const;

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

function rejectsObserverTokenFormat(candidate: string): boolean {
  return !HEX_TOKEN_PATTERN.test(candidate.trim());
}

function runVector1ObserverFormat(): void {
  console.log('\n=== VEKTÖR 1: Observer brute-force & format ===');

  const valid = randomBytes(16).toString('hex');
  assert('format: 32 hex üretim geçerli', HEX_TOKEN_PATTERN.test(valid));

  const short31 = valid.slice(0, 31);
  assert('format: 31 karakter → reddedilir', rejectsObserverTokenFormat(short31));

  const uuidLike = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  assert('format: UUID (tireli) → reddedilir', rejectsObserverTokenFormat(uuidLike));

  const sqlInject =
    "'; DROP TABLE student_observer_tokens;--" + 'a'.repeat(8);
  assert(
    'format: SQL injection girdisi → reddedilir',
    rejectsObserverTokenFormat(sqlInject),
  );

  const upperMix = valid.toUpperCase();
  assert('format: büyük harf 32 hex → kabul (case-insensitive)', !rejectsObserverTokenFormat(upperMix));

  const migration = readSrc(
    'supabase/migrations/20261109150000_student_observer_tokens.sql',
  );
  assert(
    'format: tablo CHECK 32 hex sözleşmesi',
    migration.includes("token ~ '^[a-f0-9]{32}$'"),
  );

  const atomicMigration = readSrc(
    'supabase/migrations/20261110120000_create_student_observer_token_atomic.sql',
  );
  assert(
    'format: RPC p_token regex kalkanı',
    atomicMigration.includes("p_token !~ '^[a-f0-9]{32}$'"),
  );

  const observerView = readSrc('src/app/observe/[token]/observer-view-actions.ts');
  assert(
    'format: observer-view erken HEX doğrulaması',
    observerView.includes('HEX_TOKEN_PATTERN.test(normalized)') &&
      observerView.includes('OBSERVER_INVALID_TOKEN_ERROR'),
  );

  const observePage = readSrc('src/app/observe/[token]/page.tsx');
  assert(
    'format: observe sayfa HEX yolu önce',
    observePage.includes('HEX_TOKEN_PATTERN.test(token)') &&
      observePage.includes('getObserverDashboardDataAction(token)'),
  );
}

/** Advisory lock + sayım davranışını bellek içi serileştirme ile taklit eder. */
async function simulateConcurrentObserverCreates(
  parallelRequests: number,
): Promise<Array<'created' | typeof MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI>> {
  let activeCount = 0;
  let lock: Promise<void> = Promise.resolve();
  const withLock = async <T>(fn: () => T): Promise<T> => {
    let release!: () => void;
    const wait = new Promise<void>((res) => {
      release = res;
    });
    const prev = lock;
    lock = prev.then(async () => {
      await wait;
    });
    await prev;
    try {
      return fn();
    } finally {
      release();
    }
  };

  const attempt = () =>
    withLock(() => {
      if (shouldRejectObserverTokenCreation(activeCount)) {
        return MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI;
      }
      activeCount += 1;
      return 'created' as const;
    });

  return Promise.all(
    Array.from({ length: parallelRequests }, () => attempt()),
  );
}

function runVector2Concurrency(): void {
  console.log('\n=== VEKTÖR 2: Concurrency / TOCTOU stres ===');

  assert(
    'toctou: kota sabiti 5',
    OBSERVER_MAX_ACTIVE_TOKENS === 5 &&
      shouldRejectObserverTokenCreation(5) &&
      !shouldRejectObserverTokenCreation(4),
  );

  void (async () => {
    const results = await simulateConcurrentObserverCreates(10);
    const created = results.filter((r) => r === 'created').length;
    const rejected = results.filter(
      (r) => r === MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI,
    ).length;

    assert('toctou: 10 eşzamanlı → tam 5 oluşturma', created === 5);
    assert(
      'toctou: 10 eşzamanlı → tam 5 MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI',
      rejected === 5,
    );
    assert('toctou: sonuç toplamı 10', created + rejected === 10);

    const observerActions = readSrc('src/app/student/observer-actions.ts');
    const createBlock = observerActions.slice(
      observerActions.indexOf('export async function createObserverTokenAction'),
      observerActions.indexOf('export async function revokeObserverTokenAction'),
    );
    assert(
      'toctou: create yolu getObserverSessionClient (service-role yok)',
      observerActions.includes('return await getSupabaseServer(PROFILES_SCHEMA)') &&
        createBlock.includes('getObserverSessionClient') &&
        createBlock.includes('sessionClient.rpc') &&
        !createBlock.includes('getStudentScopedClient'),
    );

    const atomicMigration = readSrc(
      'supabase/migrations/20261110120000_create_student_observer_token_atomic.sql',
    );
    assert(
      'toctou: RPC advisory lock + v_max_active 5',
      atomicMigration.includes('pg_advisory_xact_lock') &&
        atomicMigration.includes('v_max_active constant int := 5'),
    );

    printSummaryAndExit();
  })();
}

function runVector3TenantIsolation(): void {
  console.log('\n=== VEKTÖR 3: B2B tenant izolasyonu ===');

  const foreign = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: false,
    membershipOrganizationId: SAMPLE_ORG_A,
    requestedOrganizationId: SAMPLE_ORG_B,
  });
  assert(
    'tenant: koordinatör yabancı orgId → foreign_organization',
    !foreign.allowed && foreign.code === 'foreign_organization',
  );

  const own = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: false,
    membershipOrganizationId: SAMPLE_ORG_A,
    requestedOrganizationId: SAMPLE_ORG_A,
  });
  assert('tenant: kendi orgId → izin', own.allowed && own.organizationId === SAMPLE_ORG_A);

  const implicit = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: false,
    membershipOrganizationId: SAMPLE_ORG_A,
    requestedOrganizationId: undefined,
  });
  assert(
    'tenant: orgId yok → üyelik org',
    implicit.allowed && implicit.organizationId === SAMPLE_ORG_A,
  );

  const adminSwitch = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: true,
    membershipOrganizationId: SAMPLE_ORG_A,
    requestedOrganizationId: SAMPLE_ORG_B,
  });
  assert(
    'tenant: platform admin istenen org → izin',
    adminSwitch.allowed && adminSwitch.organizationId === SAMPLE_ORG_B,
  );

  const noMembership = resolveCoordinatorOrganizationAccess({
    isPlatformAdmin: false,
    membershipOrganizationId: null,
    requestedOrganizationId: SAMPLE_ORG_A,
  });
  assert(
    'tenant: üyelik yok → no_membership',
    !noMembership.allowed && noMembership.code === 'no_membership',
  );
}

function runVector4ObserverZeroLeak(): void {
  console.log('\n=== VEKTÖR 4: Salt-okunur veli (zero-leak) ===');

  const typesSource = readSrc('src/lib/observer/observer-dashboard-types.ts');
  for (const key of OBSERVER_VIEW_ALLOWED_KEYS) {
    assert(`zero-leak: tip alanı izinli → ${key}`, typesSource.includes(`${key}:`));
  }

  for (const forbidden of OBSERVER_LEAK_DENYLIST) {
    const inInterface =
      typesSource.includes(`${forbidden}:`) ||
      typesSource.includes(`${forbidden}?`);
    assert(`zero-leak: ObserverDashboardViewData → ${forbidden} yok`, !inInterface);
  }

  const observerView = readSrc('src/app/observe/[token]/observer-view-actions.ts');
  assert(
    'zero-leak: profil sorgusu parola/hash alanı seçmez',
    observerView.includes(
      "'id, role, status, first_name, last_name, full_name, target_scores'",
    ) &&
      !observerView.match(/select\([^)]*password/i),
  );

  const dataBlock = observerView.slice(
    observerView.indexOf('const data: ObserverDashboardViewData'),
    observerView.indexOf('return { success: true, data'),
  );
  assert(
    'zero-leak: data ataması yalnızca gösterim alanları',
    dataBlock.includes('studentDisplayName:') &&
      dataBlock.includes('topWeaknessTopics:') &&
      !dataBlock.includes('student_id') &&
      !dataBlock.includes('password') &&
      !dataBlock.includes('token:'),
  );

  const clientSource = readSrc('src/components/observer/ObserverViewClient.tsx');
  assert(
    'zero-leak: ObserverViewClient düzenleme aksiyonu yok',
    !clientSource.includes('use server') &&
      !clientSource.includes('updateProfile') &&
      !clientSource.includes('password'),
  );

  const pageSource = readSrc('src/app/observe/[token]/page.tsx');
  assert(
    'zero-leak: başarılı hex yolunda ObserverViewClient yalnızca data',
    pageSource.includes('<ObserverViewClient data={result.data} />'),
  );
}

function printSummaryAndExit(): void {
  console.log('\n--- Özet ---');
  console.log(`Toplam assertion: ${passed + failed}`);
  console.log(`Geçen: ${passed}`);
  console.log(`Kalan: ${failed}`);

  if (failed > 0) {
    console.error('\nRed-Team audit FAILED.');
    process.exit(1);
  }
  if (passed < 15) {
    console.error(`\nRed-Team audit: en az 15 assertion gerekli (mevcut: ${passed}).`);
    process.exit(1);
  }
  console.log('\nRed-Team audit PASSED — tüm kontroller [PASS].');
  process.exit(0);
}

function main(): void {
  console.log('Interscola Red-Team Security Audit\n');
  runVector1ObserverFormat();
  runVector3TenantIsolation();
  runVector4ObserverZeroLeak();
  runVector2Concurrency();
}

main();
