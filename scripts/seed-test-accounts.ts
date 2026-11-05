/**
 * B2B + rol test hesapları — yalnızca auth.admin.createUser ile oluşturulur.
 *
 * Kullanım: npx tsx scripts/seed-test-accounts.ts
 * Gerekli (.env.local): SUPABASE_URL veya NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '../src/lib/supabase';
import { generateRandomJoinCode } from '../src/lib/b2b/join-code';

config({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}

const TEST_PASSWORD = 'Test2026!#';

const TEST_EMAILS = [
  'test.ogrenci@interscola.test',
  'test.ogretmen@interscola.test',
  'test.veli@interscola.test',
  'test.kurum.merkez@interscola.test',
  'test.kurum.sube@interscola.test',
] as const;

const ORG_NAME = 'Interscola Test Koleji (Merkez)';
const BRANCH_MERKEZ = 'Merkez Kampüs';
const BRANCH_SUBE = 'Anadolu Şubesi';

type ProfileRole = 'student' | 'teacher';

interface SeedAccountSpec {
  email: (typeof TEST_EMAILS)[number];
  full_name: string;
  profileRole: ProfileRole;
  /** handle_new_user trigger — yalnızca profiles.role CHECK: student | teacher | admin */
  user_metadata: Record<string, unknown>;
}

const ACCOUNT_SPECS: SeedAccountSpec[] = [
  {
    email: 'test.ogrenci@interscola.test',
    full_name: 'Test Öğrenci',
    profileRole: 'student',
    user_metadata: { full_name: 'Test Öğrenci', role: 'student' },
  },
  {
    email: 'test.ogretmen@interscola.test',
    full_name: 'Test Öğretmen',
    profileRole: 'teacher',
    user_metadata: { full_name: 'Test Öğretmen', role: 'teacher' },
  },
  {
    email: 'test.veli@interscola.test',
    full_name: 'Test Veli (Gözlemci)',
    profileRole: 'student',
    user_metadata: {
      full_name: 'Test Veli (Gözlemci)',
      role: 'student',
      is_parent: true,
    },
  },
  {
    email: 'test.kurum.merkez@interscola.test',
    full_name: 'Test Kurum Merkez',
    profileRole: 'teacher',
    user_metadata: { full_name: 'Test Kurum Merkez', role: 'teacher' },
  },
  {
    email: 'test.kurum.sube@interscola.test',
    full_name: 'Test Şube Sorumlusu',
    profileRole: 'teacher',
    user_metadata: { full_name: 'Test Şube Sorumlusu', role: 'teacher' },
  },
];

interface SeedRowResult {
  email: string;
  ok: boolean;
  userId?: string;
  detail?: string;
}

async function findAuthUserIdByEmail(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Auth kullanıcı listesi okunamadı: ${error.message}`);
    }
    const users = data.users ?? [];
    const match = users.find(
      (user) => user.email?.trim().toLowerCase() === normalized,
    );
    if (match?.id) return match.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function cleanupAuthEmailsViaRpc(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  emails: readonly string[],
): Promise<boolean> {
  const { error } = await admin.rpc('cleanup_test_auth_users_emails', {
    emails: [...emails],
  });

  if (!error) {
    return true;
  }

  if (
    error.code === 'PGRST202' ||
    error.message.includes('Could not find the function')
  ) {
    console.warn(
      '[seed] cleanup_test_auth_users_emails RPC yok. ' +
        'scripts/cleanup-test-auth-users.sql dosyasını Supabase SQL Editor\'de çalıştırın ' +
        'veya migration 20251105180000_cleanup_test_auth_users_fn.sql uygulayın.',
    );
    return false;
  }

  console.warn('[seed] Auth RPC temizliği:', error.message);
  return false;
}

async function deleteTestAccount(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
): Promise<void> {
  const profileRes = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  const profileId = (profileRes.data as { id?: string } | null)?.id;

  if (profileId) {
    await admin.from('organization_members').delete().eq('user_id', profileId);
    await admin.from('profiles').delete().eq('id', profileId);
  }

  const authId =
    profileId ?? (await findAuthUserIdByEmail(admin, email));
  if (authId) {
    const { error } = await admin.auth.admin.deleteUser(authId);
    if (error && !error.message.includes('not found')) {
      console.warn(`[seed] Auth silme (${email}):`, error.message);
    }
  }
}

async function removeExistingTestOrganization(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
): Promise<void> {
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('name', ORG_NAME)
    .maybeSingle();

  const orgId = (org as { id?: string } | null)?.id;
  if (!orgId) return;

  await admin.from('organization_members').delete().eq('organization_id', orgId);
  await admin.from('branches').delete().eq('organization_id', orgId);
  await admin.from('organizations').delete().eq('id', orgId);
}

async function ensureProfile(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  userId: string,
  email: string,
  full_name: string,
  role: ProfileRole,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from('profiles')
      .update({
        email,
        full_name,
        role,
        status: 'approved',
        updated_at: now,
      })
      .eq('id', userId);
    if (error) throw new Error(`Profil güncellenemedi (${email}): ${error.message}`);
    return;
  }

  const { error } = await admin.from('profiles').insert({
    id: userId,
    email,
    full_name,
    role,
    status: 'approved',
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`Profil oluşturulamadı (${email}): ${error.message}`);
}

async function upsertOrgMember(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  params: {
    organizationId: string;
    userId: string;
    orgRole: string;
    branchId: string | null;
  },
): Promise<void> {
  const { organizationId, userId, orgRole, branchId } = params;

  await admin
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId);

  const { error } = await admin.from('organization_members').insert({
    organization_id: organizationId,
    user_id: userId,
    org_role: orgRole,
    branch_id: branchId,
    is_active: true,
  });

  if (error) {
    throw new Error(
      `organization_members (${userId}, ${orgRole}): ${error.message}`,
    );
  }
}

async function main(): Promise<void> {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (!admin) {
    console.error(
      'SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY (.env.local) gerekli.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('Interscola — test hesap tohumlaması\n');

  console.log('→ Eski test hesapları ve kurum temizleniyor…');
  await cleanupAuthEmailsViaRpc(admin, TEST_EMAILS);
  for (const email of TEST_EMAILS) {
    await deleteTestAccount(admin, email);
  }
  await removeExistingTestOrganization(admin);

  const userIds = new Map<string, string>();
  const results: SeedRowResult[] = [];

  console.log('→ Auth kullanıcıları oluşturuluyor (createUser)…\n');

  for (const spec of ACCOUNT_SPECS) {
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: spec.email,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: spec.user_metadata,
      });

      if (error || !data.user?.id) {
        results.push({
          email: spec.email,
          ok: false,
          detail: error?.message ?? 'Kullanıcı kimliği alınamadı',
        });
        continue;
      }

      const userId = data.user.id;
      await ensureProfile(
        admin,
        userId,
        spec.email,
        spec.full_name,
        spec.profileRole,
      );

      userIds.set(spec.email, userId);
      results.push({ email: spec.email, ok: true, userId });
    } catch (caught) {
      results.push({
        email: spec.email,
        ok: false,
        detail: caught instanceof Error ? caught.message : String(caught),
      });
    }
  }

  const allUsersOk = ACCOUNT_SPECS.every((spec) =>
    results.some((row) => row.email === spec.email && row.ok),
  );

  if (allUsersOk) {
    console.log('→ B2B kurum, şubeler ve üyelikler…');

    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 2);

    const { data: orgRow, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: ORG_NAME,
        license_type: 'pilot',
        student_quota: 500,
        valid_until: validUntil.toISOString(),
        is_active: true,
        join_code: generateRandomJoinCode(),
      })
      .select('id, join_code')
      .single();

    if (orgError || !orgRow) {
      throw new Error(
        `Kurum oluşturulamadı: ${orgError?.message ?? 'bilinmeyen'}`,
      );
    }

    const organizationId = (orgRow as { id: string }).id;
    const joinCode = (orgRow as { join_code?: string }).join_code;

    const { data: branchMerkez, error: branchMerkezError } = await admin
      .from('branches')
      .insert({
        organization_id: organizationId,
        name: BRANCH_MERKEZ,
        city: 'İstanbul',
      })
      .select('id')
      .single();

    const { data: branchSube, error: branchSubeError } = await admin
      .from('branches')
      .insert({
        organization_id: organizationId,
        name: BRANCH_SUBE,
        city: 'Ankara',
      })
      .select('id')
      .single();

    if (branchMerkezError || branchSubeError || !branchMerkez || !branchSube) {
      throw new Error(
        `Şube oluşturulamadı: ${branchMerkezError?.message ?? branchSubeError?.message ?? 'bilinmeyen'}`,
      );
    }

    const merkezBranchId = (branchMerkez as { id: string }).id;
    const subeBranchId = (branchSube as { id: string }).id;

    const merkezUserId = userIds.get('test.kurum.merkez@interscola.test');
    const subeUserId = userIds.get('test.kurum.sube@interscola.test');
    const teacherUserId = userIds.get('test.ogretmen@interscola.test');
    const studentUserId = userIds.get('test.ogrenci@interscola.test');

    if (merkezUserId) {
      await upsertOrgMember(admin, {
        organizationId,
        userId: merkezUserId,
        orgRole: 'org_admin',
        branchId: merkezBranchId,
      });
    }
    if (subeUserId) {
      await upsertOrgMember(admin, {
        organizationId,
        userId: subeUserId,
        orgRole: 'coordinator',
        branchId: subeBranchId,
      });
    }
    if (teacherUserId) {
      await upsertOrgMember(admin, {
        organizationId,
        userId: teacherUserId,
        orgRole: 'teacher',
        branchId: subeBranchId,
      });
    }
    if (studentUserId) {
      await upsertOrgMember(admin, {
        organizationId,
        userId: studentUserId,
        orgRole: 'student',
        branchId: subeBranchId,
      });
    }

    console.log(`   Kurum ID: ${organizationId}`);
    console.log(`   Katılım kodu: ${joinCode ?? '—'}`);
    console.log(`   Şube (merkez): ${merkezBranchId}`);
    console.log(`   Şube (anadolu): ${subeBranchId}\n`);
  }

  console.log('--- Özet ---');
  console.log(`Parola (tüm hesaplar): ${TEST_PASSWORD}\n`);

  for (const row of results) {
    const status = row.ok ? 'OK' : 'HATA';
    const idPart = row.userId ? row.userId : '—';
    const detail = row.detail ? ` (${row.detail})` : '';
    console.log(`[${status}] ${row.email}`);
    console.log(`        id: ${idPart}${detail}`);
  }

  const emailBlocked = results.some((row) =>
    row.detail?.includes('Database error checking email'),
  );
  if (emailBlocked) {
    console.error(
      '\nAuth e-posta kontrolü başarısız (muhtemelen bozuk auth.users SQL kaydı).',
    );
    console.error(
      'Çözüm: scripts/cleanup-test-auth-users.sql → Supabase SQL Editor → tekrar seed.',
    );
  }

  if (!allUsersOk) {
    process.exitCode = 1;
    console.error('\nBazı hesaplar oluşturulamadı.');
  } else {
    console.log('\nTüm test hesapları başarıyla tohumlandı.');
    console.log(
      'Not: B2B org_admin / coordinator yalnızca organization_members.org_role üzerinden tanımlıdır.',
    );
  }
}

main().catch((error) => {
  console.error(
    '\nSeed başarısız:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
