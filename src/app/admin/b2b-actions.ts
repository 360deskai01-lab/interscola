'use server';

import { revalidatePath } from 'next/cache';
import { requireApprovedAdmin } from '@/app/admin/actions';
import {
  generateRandomJoinCode,
  JOIN_CODE_LENGTH,
  normalizeJoinCodeInput,
} from '@/lib/b2b/join-code';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';

const DASHBOARD_PATH = '/admin/dashboard';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LICENSE_TYPES = new Set(['standard', 'pilot', 'enterprise']);
const ORG_ROLES = new Set(['org_admin', 'coordinator', 'teacher']);

export interface B2BActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface B2BOrganizationRow {
  id: string;
  name: string;
  licenseType: string | null;
  studentQuota: number | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  branchCount: number;
  memberCount: number;
  /** Aktif `org_role = student` üye sayısı (kota kullanımı). */
  seatsUsed: number;
  joinCode: string | null;
}

export interface B2BBranchRow {
  id: string;
  organizationId: string;
  name: string;
  city: string | null;
}

export interface B2BAssignableUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface B2BOrgMemberRow {
  id: string;
  organizationId: string;
  userId: string;
  fullName: string;
  email: string;
  orgRole: string;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
}

export interface B2BManagementData {
  organizations: B2BOrganizationRow[];
  branchesByOrganization: Record<string, B2BBranchRow[]>;
  membersByOrganization: Record<string, B2BOrgMemberRow[]>;
  assignableUsers: B2BAssignableUser[];
}

async function getPublicClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

function mapOrgRow(
  row: {
    id: string;
    name: string;
    license_type: string | null;
    student_quota: number | null;
    valid_until: string | null;
    is_active: boolean | null;
    created_at: string;
    join_code?: string | null;
  },
  branchCount: number,
  memberCount: number,
  seatsUsed: number,
): B2BOrganizationRow {
  const rawJoin = row.join_code;
  const joinCode =
    typeof rawJoin === 'string' && rawJoin.trim()
      ? normalizeJoinCodeInput(rawJoin)
      : null;

  return {
    id: row.id,
    name: row.name,
    licenseType: row.license_type,
    studentQuota: row.student_quota,
    validUntil: row.valid_until,
    isActive: row.is_active ?? false,
    createdAt: row.created_at,
    branchCount,
    memberCount,
    seatsUsed,
    joinCode: joinCode && joinCode.length === JOIN_CODE_LENGTH ? joinCode : null,
  };
}

export async function getB2BManagementDataAction(): Promise<
  B2BActionResult<B2BManagementData>
> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu veri için master admin yetkisi gerekiyor.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const [orgResult, branchResult, memberResult, profilesResult] =
      await Promise.all([
        client
          .from('organizations')
          .select(
            'id, name, license_type, student_quota, valid_until, is_active, created_at, join_code',
          )
          .order('created_at', { ascending: false }),
        client.from('branches').select('id, organization_id, name, city'),
        client
          .from('organization_members')
          .select(
            'id, organization_id, branch_id, user_id, org_role, is_active',
          ),
        client
          .from('profiles')
          .select('id, email, full_name, role, status')
          .eq('status', 'approved')
          .neq('role', 'admin')
          .order('created_at', { ascending: false }),
      ]);

    type OrgRow = {
      id: string;
      name: string;
      license_type: string | null;
      student_quota: number | null;
      valid_until: string | null;
      is_active: boolean | null;
      created_at: string;
      join_code?: string | null;
    };

    let organizationRows: OrgRow[] = [];

    if (orgResult.error) {
      console.error('[b2b] Kurumlar okunamadı:', orgResult.error.message);
      if (orgResult.error.code === '42703') {
        const fallback = await client
          .from('organizations')
          .select(
            'id, name, license_type, student_quota, valid_until, is_active, created_at',
          )
          .order('created_at', { ascending: false });
        if (fallback.error) {
          return { success: false, error: 'Kurum listesi okunamadı.' };
        }
        organizationRows = (fallback.data ?? []) as OrgRow[];
      } else {
        return { success: false, error: 'Kurum listesi okunamadı.' };
      }
    } else {
      organizationRows = (orgResult.data ?? []) as OrgRow[];
    }

    const branches = (branchResult.data ?? []) as {
      id: string;
      organization_id: string;
      name: string;
      city: string | null;
    }[];

    const members = (memberResult.data ?? []) as {
      id: string;
      organization_id: string;
      branch_id: string | null;
      user_id: string;
      org_role: string | null;
      is_active: boolean | null;
    }[];

    const branchNameById = new Map<string, string>();
    for (const branch of branches) {
      branchNameById.set(branch.id, branch.name);
    }

    const memberUserIds = [
      ...new Set(
        members
          .map((member) => member.user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];

    const profileByUserId = new Map<
      string,
      { full_name: string | null; email: string }
    >();

    if (memberUserIds.length > 0) {
      const { data: memberProfiles, error: memberProfileError } = await client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberUserIds);

      if (memberProfileError) {
        console.error(
          '[b2b] Üye profilleri okunamadı:',
          memberProfileError.message,
        );
      } else {
        for (const profile of memberProfiles ?? []) {
          const row = profile as {
            id: string;
            full_name: string | null;
            email: string;
          };
          profileByUserId.set(row.id, {
            full_name: row.full_name,
            email: row.email,
          });
        }
      }
    }

    const membersByOrganization: Record<string, B2BOrgMemberRow[]> = {};

    const branchCountByOrg = new Map<string, number>();
    const memberCountByOrg = new Map<string, number>();
    const studentSeatsByOrg = new Map<string, number>();
    const branchesByOrganization: Record<string, B2BBranchRow[]> = {};

    for (const branch of branches) {
      branchCountByOrg.set(
        branch.organization_id,
        (branchCountByOrg.get(branch.organization_id) ?? 0) + 1,
      );
      const list = branchesByOrganization[branch.organization_id] ?? [];
      list.push({
        id: branch.id,
        organizationId: branch.organization_id,
        name: branch.name,
        city: branch.city,
      });
      branchesByOrganization[branch.organization_id] = list;
    }

    for (const member of members) {
      const profile = profileByUserId.get(member.user_id);
      const branchName = member.branch_id
        ? (branchNameById.get(member.branch_id) ?? null)
        : null;

      const memberRow: B2BOrgMemberRow = {
        id: member.id,
        organizationId: member.organization_id,
        userId: member.user_id,
        fullName:
          profile?.full_name?.trim() || profile?.email || 'İsimsiz kullanıcı',
        email: profile?.email ?? '—',
        orgRole: member.org_role ?? 'teacher',
        branchId: member.branch_id,
        branchName,
        isActive: member.is_active !== false,
      };

      const orgMemberList = membersByOrganization[member.organization_id] ?? [];
      orgMemberList.push(memberRow);
      membersByOrganization[member.organization_id] = orgMemberList;

      if (member.is_active === false) continue;
      memberCountByOrg.set(
        member.organization_id,
        (memberCountByOrg.get(member.organization_id) ?? 0) + 1,
      );
      if (member.org_role === 'student') {
        studentSeatsByOrg.set(
          member.organization_id,
          (studentSeatsByOrg.get(member.organization_id) ?? 0) + 1,
        );
      }
    }

    const organizations = organizationRows.map((row) =>
      mapOrgRow(
        row,
        branchCountByOrg.get(row.id) ?? 0,
        memberCountByOrg.get(row.id) ?? 0,
        studentSeatsByOrg.get(row.id) ?? 0,
      ),
    );

    const assignableUsers: B2BAssignableUser[] = (
      (profilesResult.data ?? []) as {
        id: string;
        email: string;
        full_name: string | null;
        role: string;
      }[]
    ).map((profile) => ({
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name?.trim() || profile.email,
      role: profile.role,
    }));

    return {
      success: true,
      data: {
        organizations,
        branchesByOrganization,
        membersByOrganization,
        assignableUsers,
      },
    };
  } catch (error) {
    console.error(
      '[b2b] getB2BManagementDataAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'B2B verisi yüklenemedi.' };
  }
}

export async function createOrganizationAction(data: {
  name: string;
  license_type: 'standard' | 'pilot' | 'enterprise';
  student_quota: number;
  valid_until?: string;
}): Promise<B2BActionResult<{ id: string }>> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    const name = data.name?.trim() ?? '';
    if (name.length < 2) {
      return { success: false, error: 'Kurum adı en az 2 karakter olmalı.' };
    }

    const licenseType = data.license_type;
    if (!LICENSE_TYPES.has(licenseType)) {
      return { success: false, error: 'Geçersiz lisans tipi.' };
    }

    const quota = Number(data.student_quota);
    if (!Number.isFinite(quota) || quota < 1) {
      return { success: false, error: 'Öğrenci kotası en az 1 olmalı.' };
    }

    let validUntil: string | null = null;
    if (typeof data.valid_until === 'string' && data.valid_until.trim()) {
      validUntil = data.valid_until.trim();
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: inserted, error } = await client
      .from('organizations')
      .insert({
        name,
        license_type: licenseType,
        student_quota: quota,
        valid_until: validUntil,
        is_active: true,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('[b2b] Kurum eklenemedi:', error?.message);
      return { success: false, error: 'Kurum kaydedilemedi.' };
    }

    revalidatePath(DASHBOARD_PATH);
    return { success: true, data: { id: (inserted as { id: string }).id } };
  } catch (error) {
    console.error(
      '[b2b] createOrganizationAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function createBranchAction(
  organizationId: string,
  name: string,
  city?: string,
): Promise<B2BActionResult<{ id: string }>> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    if (!UUID_PATTERN.test(organizationId)) {
      return { success: false, error: 'Geçersiz kurum kimliği.' };
    }

    const branchName = name?.trim() ?? '';
    if (branchName.length < 2) {
      return { success: false, error: 'Şube adı en az 2 karakter olmalı.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: org, error: orgError } = await client
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError || !org) {
      return { success: false, error: 'Kurum bulunamadı.' };
    }

    const cityValue =
      typeof city === 'string' && city.trim() ? city.trim() : null;

    const { data: inserted, error } = await client
      .from('branches')
      .insert({
        organization_id: organizationId,
        name: branchName,
        city: cityValue,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('[b2b] Şube eklenemedi:', error?.message);
      return { success: false, error: 'Şube kaydedilemedi.' };
    }

    revalidatePath(DASHBOARD_PATH);
    return { success: true, data: { id: (inserted as { id: string }).id } };
  } catch (error) {
    console.error(
      '[b2b] createBranchAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function assignMemberToOrgAction(
  organizationId: string,
  branchId: string | null,
  userId: string,
  orgRole: 'org_admin' | 'coordinator' | 'teacher',
): Promise<B2BActionResult> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    if (!UUID_PATTERN.test(organizationId) || !UUID_PATTERN.test(userId)) {
      return { success: false, error: 'Geçersiz kimlik.' };
    }

    if (branchId !== null && !UUID_PATTERN.test(branchId)) {
      return { success: false, error: 'Geçersiz şube kimliği.' };
    }

    if (!ORG_ROLES.has(orgRole)) {
      return { success: false, error: 'Geçersiz kurum rolü.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: org, error: orgError } = await client
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .maybeSingle();

    if (orgError || !org) {
      return { success: false, error: 'Kurum bulunamadı.' };
    }

    if (branchId) {
      const { data: branch, error: branchError } = await client
        .from('branches')
        .select('id, organization_id')
        .eq('id', branchId)
        .maybeSingle();

      if (branchError || !branch) {
        return { success: false, error: 'Şube bulunamadı.' };
      }

      if ((branch as { organization_id: string }).organization_id !== organizationId) {
        return { success: false, error: 'Şube seçilen kuruma ait değil.' };
      }
    }

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, role, status')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return { success: false, error: 'Kullanıcı bulunamadı.' };
    }

    const user = profile as { id: string; role: string; status: string };
    if (user.status !== 'approved') {
      return { success: false, error: 'Yalnızca onaylı kullanıcı atanabilir.' };
    }

    if (user.role === 'admin') {
      return { success: false, error: 'Platform admini kuruma bu yolla atanamaz.' };
    }

    const duplicateMessage =
      'Bu kullanıcı seçilen kuruma zaten atanmış.';

    const { data: existing, error: dupError } = await client
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (dupError) {
      console.error('[b2b] Üyelik kontrolü başarısız:', dupError.message);
    } else if (existing) {
      return { success: false, error: duplicateMessage };
    }

    const { error: insertError } = await client
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        branch_id: branchId,
        user_id: userId,
        org_role: orgRole,
        is_active: true,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return { success: false, error: duplicateMessage };
      }
      console.error('[b2b] Üye atanamadı:', insertError.message);
      return { success: false, error: 'Kullanıcı kuruma atanamadı.' };
    }

    revalidatePath(DASHBOARD_PATH);
    return { success: true };
  } catch (error) {
    console.error(
      '[b2b] assignMemberToOrgAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

// ---------------------------------------------------------------------------
// Şube güncelleme / kaldırma
// ---------------------------------------------------------------------------

export async function updateBranchAction(
  branchId: string,
  organizationId: string,
  data: { name: string; city?: string },
): Promise<B2BActionResult> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    if (!UUID_PATTERN.test(branchId) || !UUID_PATTERN.test(organizationId)) {
      return { success: false, error: 'Geçersiz kimlik.' };
    }

    const name = data.name?.trim() ?? '';
    if (name.length < 2) {
      return { success: false, error: 'Şube adı en az 2 karakter olmalı.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: branch, error: readError } = await client
      .from('branches')
      .select('id, organization_id')
      .eq('id', branchId)
      .maybeSingle();

    if (readError || !branch) {
      return { success: false, error: 'Şube bulunamadı.' };
    }

    if ((branch as { organization_id: string }).organization_id !== organizationId) {
      return { success: false, error: 'Şube seçilen kuruma ait değil.' };
    }

    const cityValue =
      typeof data.city === 'string' && data.city.trim()
        ? data.city.trim()
        : null;

    const { error: updateError } = await client
      .from('branches')
      .update({
        name,
        city: cityValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', branchId);

    if (updateError) {
      console.error('[b2b] Şube güncellenemedi:', updateError.message);
      return { success: false, error: 'Şube güncellenemedi.' };
    }

    revalidatePath(DASHBOARD_PATH);
    return { success: true };
  } catch (error) {
    console.error(
      '[b2b] updateBranchAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/**
 * Şubeyi kaldırır. Aktif üye bağlıysa önce üyeleri pasife alır, sonra siler.
 */
export async function removeBranchAction(
  branchId: string,
  organizationId: string,
): Promise<B2BActionResult> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    if (!UUID_PATTERN.test(branchId) || !UUID_PATTERN.test(organizationId)) {
      return { success: false, error: 'Geçersiz kimlik.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: branch, error: readError } = await client
      .from('branches')
      .select('id, organization_id')
      .eq('id', branchId)
      .maybeSingle();

    if (readError || !branch) {
      return { success: false, error: 'Şube bulunamadı.' };
    }

    if ((branch as { organization_id: string }).organization_id !== organizationId) {
      return { success: false, error: 'Şube seçilen kuruma ait değil.' };
    }

    const { error: deactivateError } = await client
      .from('organization_members')
      .update({
        is_active: false,
        branch_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('branch_id', branchId)
      .eq('organization_id', organizationId);

    if (deactivateError) {
      console.error(
        '[b2b] Şube üyeleri pasife alınamadı:',
        deactivateError.message,
      );
      return { success: false, error: 'Şube üyeleri güncellenemedi.' };
    }

    const { error: deleteError } = await client
      .from('branches')
      .delete()
      .eq('id', branchId);

    if (deleteError) {
      console.error('[b2b] Şube silinemedi:', deleteError.message);
      return { success: false, error: 'Şube kaldırılamadı.' };
    }

    revalidatePath(DASHBOARD_PATH);
    return { success: true };
  } catch (error) {
    console.error(
      '[b2b] removeBranchAction hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

const JOIN_CODE_UNIQUE_RETRIES = 12;

export async function generateOrRegenerateJoinCodeAction(
  orgId: string,
): Promise<B2BActionResult<{ joinCode: string }>> {
  try {
    const admin = await requireApprovedAdmin();
    if (!admin) {
      return { success: false, error: 'Bu işlem için master admin yetkisi gerekiyor.' };
    }

    if (!UUID_PATTERN.test(orgId)) {
      return { success: false, error: 'Geçersiz kurum kimliği.' };
    }

    const client = await getPublicClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: org, error: orgError } = await client
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .maybeSingle();

    if (orgError || !org) {
      return { success: false, error: 'Kurum bulunamadı.' };
    }

    for (let attempt = 0; attempt < JOIN_CODE_UNIQUE_RETRIES; attempt += 1) {
      const candidate = generateRandomJoinCode();
      const { error: updateError } = await client
        .from('organizations')
        .update({ join_code: candidate })
        .eq('id', orgId);

      if (!updateError) {
        revalidatePath(DASHBOARD_PATH);
        return { success: true, data: { joinCode: candidate } };
      }

      if (updateError.code === '23505') {
        continue;
      }

      if (updateError.code === '42703') {
        return {
          success: false,
          error:
            'join_code kolonu veritabanında tanımlı değil. Migration uygulayın.',
        };
      }

      console.error('[b2b] join_code güncellenemedi:', updateError.message);
      return { success: false, error: 'Katılım kodu kaydedilemedi.' };
    }

    return {
      success: false,
      error: 'Benzersiz katılım kodu üretilemedi. Tekrar deneyin.',
    };
  } catch (error) {
    console.error(
      '[b2b] generateOrRegenerateJoinCodeAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

// ---------------------------------------------------------------------------
// Client köprüleri
// ---------------------------------------------------------------------------

export async function createOrganizationFormAction(input: {
  name: string;
  license_type: 'standard' | 'pilot' | 'enterprise';
  student_quota: number;
  valid_until?: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await createOrganizationAction(input);
  return { success: result.success, error: result.error };
}

export async function createBranchFormAction(input: {
  organizationId: string;
  name: string;
  city?: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await createBranchAction(
    input.organizationId,
    input.name,
    input.city,
  );
  return { success: result.success, error: result.error };
}

export async function assignMemberFormAction(input: {
  organizationId: string;
  branchId: string | null;
  userId: string;
  orgRole: 'org_admin' | 'coordinator' | 'teacher';
}): Promise<{ success: boolean; error?: string }> {
  const result = await assignMemberToOrgAction(
    input.organizationId,
    input.branchId,
    input.userId,
    input.orgRole,
  );
  return { success: result.success, error: result.error };
}

export async function updateBranchFormAction(input: {
  branchId: string;
  organizationId: string;
  name: string;
  city?: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await updateBranchAction(
    input.branchId,
    input.organizationId,
    { name: input.name, city: input.city },
  );
  return { success: result.success, error: result.error };
}

export async function removeBranchFormAction(input: {
  branchId: string;
  organizationId: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await removeBranchAction(
    input.branchId,
    input.organizationId,
  );
  return { success: result.success, error: result.error };
}

export async function generateJoinCodeFormAction(orgId: string): Promise<{
  success: boolean;
  error?: string;
  joinCode?: string;
}> {
  const result = await generateOrRegenerateJoinCodeAction(orgId);
  return {
    success: result.success,
    error: result.error,
    joinCode: result.data?.joinCode,
  };
}
