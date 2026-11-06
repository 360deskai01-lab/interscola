'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth';
import type {
  JoinOrganizationResult,
  StudentGoalsContext,
  StudentTargetScores,
  UpdateStudentGoalsPayload,
} from '@/lib/student-profile/types';
import {
  JOIN_CODE_PATTERN,
  normalizeJoinCodeInput,
} from '@/lib/b2b/join-code';
import {
  isOrganizationLicenseActive,
  isStudentQuotaExceeded,
  normalizeStudentQuota,
  ORG_JOIN_LICENSE_INACTIVE_MESSAGE,
  ORG_JOIN_QUOTA_FULL_MESSAGE,
} from '@/lib/b2b/license-quota';
import {
  getStudentProfileDbClient,
  loadStudentGoalsContext,
  loadStudentOrganization,
  parseInterestTags,
} from '@/lib/student-profile/load-context';
import { GUEST_LEAD_TARGET_SCORES_KEY } from '@/lib/guest-lead/constants';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
const STUDENT_DASHBOARD_PATH = '/student/dashboard';
const STUDENT_GOALS_PATH = '/student/goals';
const STUDENT_CONNECTIONS_PATH = '/student/connections';
const STUDENT_PROFILE_PATH = '/student/profile';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_SCORE_KEYS = new Set(['SAT', 'IELTS', 'CAIE']);

async function requireApprovedStudent(): Promise<{ userId: string } | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'student') return null;
  if (current.profile.status !== 'approved') return null;
  return { userId: current.user.id };
}

function normalizeGoalsPayload(payload: UpdateStudentGoalsPayload): {
  targetScores: StudentTargetScores;
  targetUniversityIds: string[];
  interestTags: string[];
  error?: string;
} {
  const targetScores: StudentTargetScores = {};
  const rawScores = payload.targetScores ?? {};

  for (const key of ALLOWED_SCORE_KEYS) {
    const value = rawScores[key];
    if (value === undefined || value === null || value === '') continue;

    if (key === 'SAT') {
      const num =
        typeof value === 'number' ? value : Number.parseInt(String(value), 10);
      if (!Number.isFinite(num) || num < 400 || num > 1600) {
        return {
          targetScores: {},
          targetUniversityIds: [],
          interestTags: [],
          error: 'Digital SAT hedefi 400–1600 arasında olmalı.',
        };
      }
      targetScores.SAT = num;
      continue;
    }

    if (key === 'IELTS') {
      const num =
        typeof value === 'number' ? value : Number.parseFloat(String(value));
      if (!Number.isFinite(num) || num < 0 || num > 9) {
        return {
          targetScores: {},
          targetUniversityIds: [],
          interestTags: [],
          error: 'IELTS hedefi 0–9 band aralığında olmalı.',
        };
      }
      targetScores.IELTS = Math.round(num * 2) / 2;
      continue;
    }

    if (key === 'CAIE') {
      const text = String(value).trim().toUpperCase();
      if (text.length > 0) targetScores.CAIE = text;
    }
  }

  const ids = (payload.targetUniversityIds ?? []).filter((id) =>
    UUID_PATTERN.test(id),
  );
  const uniqueIds = [...new Set(ids)];

  const interestTags = parseInterestTags(payload.interestTags ?? []);

  return { targetScores, targetUniversityIds: uniqueIds, interestTags };
}

async function getProfilesClient() {
  return getStudentProfileDbClient();
}

export async function getStudentGoalsContextAction(): Promise<{
  success: boolean;
  error?: string;
  data?: StudentGoalsContext;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return { success: false, error: 'Bu işlem için onaylı öğrenci oturumu gerekir.' };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const loaded = await loadStudentGoalsContext(client, student.userId);
    if (!loaded.ok) {
      return { success: false, error: loaded.error };
    }

    return { success: true, data: loaded.data };
  } catch (error) {
    console.error(
      '[student-profile] getStudentGoalsContextAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Hedef profili yüklenemedi.' };
  }
}

export async function updateStudentGoalsAction(
  payload: UpdateStudentGoalsPayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return { success: false, error: 'Bu işlem için onaylı öğrenci oturumu gerekir.' };
    }

    const normalized = normalizeGoalsPayload(payload);
    if (normalized.error) {
      return { success: false, error: normalized.error };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: existingProfile } = await client
      .from('profiles')
      .select('target_scores')
      .eq('id', student.userId)
      .maybeSingle();

    const existingScores =
      existingProfile?.target_scores &&
      typeof existingProfile.target_scores === 'object' &&
      !Array.isArray(existingProfile.target_scores)
        ? (existingProfile.target_scores as Record<string, unknown>)
        : {};

    const guestLead = existingScores[GUEST_LEAD_TARGET_SCORES_KEY];
    const nextTargetScores: Record<string, unknown> = {
      ...normalized.targetScores,
    };
    if (guestLead !== undefined) {
      nextTargetScores[GUEST_LEAD_TARGET_SCORES_KEY] = guestLead;
    }

    const { error } = await client
      .from('profiles')
      .update({
        target_scores: nextTargetScores,
        target_university_ids: normalized.targetUniversityIds,
        target_interest_tags: normalized.interestTags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', student.userId);

    if (error) {
      console.error('[student-profile] Hedef güncellenemedi:', error.message);
      if (error.code === '42703') {
        return {
          success: false,
          error:
            'Profil hedef alanları henüz veritabanında tanımlı değil. Yöneticinize başvurun.',
        };
      }
      return { success: false, error: 'Hedefler kaydedilemedi.' };
    }

    revalidatePath(STUDENT_DASHBOARD_PATH);
    revalidatePath(STUDENT_GOALS_PATH);
    return { success: true };
  } catch (error) {
    console.error(
      '[student-profile] updateStudentGoalsAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function joinOrganizationByCodeAction(
  joinCode: string,
): Promise<JoinOrganizationResult> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        message: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const normalized = normalizeJoinCodeInput(joinCode);
    if (!JOIN_CODE_PATTERN.test(normalized)) {
      return {
        success: false,
        message:
          'Katılım kodu 6 karakter olmalıdır (0/O ve 1/I kullanılmaz).',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, message: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const existingOrg = await loadStudentOrganization(client, student.userId);
    if (existingOrg) {
      return {
        success: false,
        message: `Zaten ${existingOrg.orgName} kurumuna bağlısın.`,
        orgName: existingOrg.orgName,
      };
    }

    const { data: orgRow, error: orgError } = await client
      .from('organizations')
      .select('id, name, is_active, join_code, student_quota, valid_until')
      .eq('join_code', normalized)
      .maybeSingle();

    if (orgError) {
      console.error('[student-profile] Kurum kodu araması:', orgError.message);
      if (orgError.code === '42703') {
        return {
          success: false,
          message:
            'Kurum katılım kodu alanı henüz etkin değil. Yöneticinize başvurun.',
        };
      }
      return { success: false, message: 'Kurum araması başarısız oldu.' };
    }

    if (!orgRow) {
      return {
        success: false,
        message: ORG_JOIN_LICENSE_INACTIVE_MESSAGE,
      };
    }

    const org = orgRow as {
      id: string;
      name: string;
      is_active: boolean | null;
      student_quota: number | null;
      valid_until: string | null;
    };

    if (
      !isOrganizationLicenseActive(org.is_active, org.valid_until)
    ) {
      return {
        success: false,
        message: ORG_JOIN_LICENSE_INACTIVE_MESSAGE,
      };
    }

    const studentQuota = normalizeStudentQuota(org.student_quota);

    const { count: seatsUsed, error: countError } = await client
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('org_role', 'student')
      .eq('is_active', true);

    if (countError) {
      console.error('[student-profile] Kota sayımı:', countError.message);
      return {
        success: false,
        message: 'Kurum kotası doğrulanamadı. Lütfen tekrar deneyin.',
      };
    }

    const usedSeats = seatsUsed ?? 0;
    if (isStudentQuotaExceeded(usedSeats, studentQuota)) {
      return {
        success: false,
        message: ORG_JOIN_QUOTA_FULL_MESSAGE,
      };
    }

    const { data: duplicate, error: dupError } = await client
      .from('organization_members')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', student.userId)
      .maybeSingle();

    if (dupError) {
      console.error('[student-profile] Üyelik kontrolü:', dupError.message);
    } else if (duplicate) {
      return {
        success: true,
        message: `${org.name} kurumuna zaten kayıtlısın.`,
        orgName: org.name,
      };
    }

    const { error: insertError } = await client.from('organization_members').insert({
      organization_id: org.id,
      branch_id: null,
      user_id: student.userId,
      org_role: 'student',
      is_active: true,
    });

    if (insertError) {
      console.error('[student-profile] Kuruma katılım:', insertError.message);
      if (insertError.code === '23505') {
        return {
          success: true,
          message: `${org.name} kurumuna zaten kayıtlısın.`,
          orgName: org.name,
        };
      }
      return { success: false, message: 'Kuruma bağlanılamadı.' };
    }

    revalidatePath(STUDENT_DASHBOARD_PATH);
    revalidatePath(STUDENT_CONNECTIONS_PATH);
    return {
      success: true,
      message: `${org.name} kurumuna başarıyla bağlandın.`,
      orgName: org.name,
    };
  } catch (error) {
    console.error(
      '[student-profile] joinOrganizationByCodeAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, message: 'Beklenmeyen bir hata oluştu.' };
  }
}

// ---------------------------------------------------------------------------
// Akademik pasaport & veli gözlemci bağlantısı
// ---------------------------------------------------------------------------

export interface StudentAcademicProfilePayload {
  firstName: string;
  lastName: string;
  highSchoolName: string;
  graduationYear: string;
  linkedinUrl: string;
  externalPortfolioUrl: string;
  instagramHandle: string;
  alumniNetworkOptIn: boolean;
}

export interface StudentAcademicProfileRow {
  firstName: string | null;
  lastName: string | null;
  highSchoolName: string | null;
  graduationYear: number | null;
  linkedinUrl: string | null;
  externalPortfolioUrl: string | null;
  instagramHandle: string | null;
  alumniNetworkOptIn: boolean;
  observerToken: string;
  publicPortfolioSlug: string | null;
  legacyFullName: string | null;
}

function trimOrNull(value: string): string | null {
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function parseOptionalUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function parseOptionalInstagram(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.includes('instagram.com')) {
    return parseOptionalUrl(t);
  }
  const handle = t.replace(/^@+/, '').trim();
  if (handle.length < 2 || handle.length > 64) return null;
  if (!/^[a-z0-9._]+$/i.test(handle)) return null;
  return `https://instagram.com/${handle}`;
}

function parseGraduationYear(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  const y = new Date().getFullYear();
  if (!Number.isFinite(n) || n < y - 2 || n > y + 12) return null;
  return n;
}

function generatePublicPortfolioSlug(): string {
  const hex = crypto.randomUUID().replace(/-/g, '');
  return hex.slice(0, 12);
}

export async function getStudentAcademicProfileAction(): Promise<{
  success: boolean;
  error?: string;
  data?: StudentAcademicProfileRow;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data, error } = await client
      .from('profiles')
      .select(
        `
        full_name,
        first_name,
        last_name,
        high_school_name,
        graduation_year,
        linkedin_url,
        external_portfolio_url,
        instagram_handle,
        alumni_network_opt_in,
        observer_link_token,
        public_portfolio_slug
      `,
      )
      .eq('id', student.userId)
      .maybeSingle();

    if (error) {
      console.error('[student-profile] akademik profil okuma:', error.message);
      if (error.code === '42703') {
        return {
          success: false,
          error:
            'Profil alanları henüz veritabanında tanımlı değil. Yöneticinize başvurun.',
        };
      }
      return { success: false, error: 'Profil okunamadı.' };
    }

    const row = data as {
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      high_school_name: string | null;
      graduation_year: number | null;
      linkedin_url: string | null;
      external_portfolio_url: string | null;
      instagram_handle: string | null;
      alumni_network_opt_in: boolean | null;
      observer_link_token: string;
      public_portfolio_slug: string | null;
    } | null;

    if (!row?.observer_link_token) {
      return { success: false, error: 'Gözlemci bağlantısı oluşturulamadı.' };
    }

    return {
      success: true,
      data: {
        legacyFullName: row.full_name,
        firstName: row.first_name,
        lastName: row.last_name,
        highSchoolName: row.high_school_name,
        graduationYear: row.graduation_year,
        linkedinUrl: row.linkedin_url,
        externalPortfolioUrl: row.external_portfolio_url,
        instagramHandle: row.instagram_handle,
        alumniNetworkOptIn: row.alumni_network_opt_in ?? false,
        observerToken: row.observer_link_token,
        publicPortfolioSlug: row.public_portfolio_slug,
      },
    };
  } catch (error) {
    console.error(
      '[student-profile] getStudentAcademicProfileAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Profil yüklenemedi.' };
  }
}

export async function updateStudentAcademicProfileAction(
  payload: StudentAcademicProfilePayload,
): Promise<{
  success: boolean;
  error?: string;
  publicPortfolioSlug?: string;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const firstName = trimOrNull(payload.firstName);
    const lastName = trimOrNull(payload.lastName);
    const highSchool = trimOrNull(payload.highSchoolName);
    const gradYear = parseGraduationYear(payload.graduationYear);

    const linkedin = parseOptionalUrl(payload.linkedinUrl);
    const portfolio = parseOptionalUrl(payload.externalPortfolioUrl);
    const instagram = parseOptionalInstagram(payload.instagramHandle);

    if (payload.linkedinUrl.trim() && !linkedin) {
      return { success: false, error: 'LinkedIn URL geçerli değil.' };
    }
    if (payload.externalPortfolioUrl.trim() && !portfolio) {
      return { success: false, error: 'Portfolyo bağlantısı geçerli değil.' };
    }
    if (payload.instagramHandle.trim() && !instagram) {
      return {
        success: false,
        error: 'Instagram kullanıcı adı veya bağlantısı geçerli değil.',
      };
    }
    if (payload.graduationYear.trim() && gradYear === null) {
      return {
        success: false,
        error: 'Mezuniyet yılı geçerli bir yıl olmalıdır.',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data: existing, error: readError } = await client
      .from('profiles')
      .select('public_portfolio_slug')
      .eq('id', student.userId)
      .maybeSingle();

    if (readError) {
      console.error('[student-profile] profil okuma:', readError.message);
      return { success: false, error: 'Profil okunamadı.' };
    }

    const existingRow = existing as { public_portfolio_slug: string | null } | null;
    let slug = existingRow?.public_portfolio_slug ?? null;

    const combinedFullName =
      firstName && lastName
        ? `${firstName} ${lastName}`
        : firstName ?? lastName ?? null;

    const maxSlugAttempts = slug ? 1 : 6;
    let lastErrorMessage = 'Profil kaydedilemedi.';

    for (let attempt = 0; attempt < maxSlugAttempts; attempt++) {
      const nextSlug = slug ?? generatePublicPortfolioSlug();

      const { error } = await client
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: combinedFullName,
          high_school_name: highSchool,
          graduation_year: gradYear,
          linkedin_url: linkedin,
          external_portfolio_url: portfolio,
          instagram_handle: instagram,
          alumni_network_opt_in: payload.alumniNetworkOptIn,
          public_portfolio_slug: nextSlug,
          updated_at: new Date().toISOString(),
        })
        .eq('id', student.userId);

      if (!error) {
        slug = nextSlug;
        revalidatePath(STUDENT_DASHBOARD_PATH);
        revalidatePath(STUDENT_PROFILE_PATH);
        revalidatePath(`/portfolio/public/${nextSlug}`);
        return { success: true, publicPortfolioSlug: nextSlug };
      }

      lastErrorMessage = error.message;
      console.error('[student-profile] akademik profil güncelleme:', error.message);

      if (error.code === '23505' && !existingRow?.public_portfolio_slug) {
        continue;
      }

      if (error.code === '42703') {
        return {
          success: false,
          error:
            'Profil alanları henüz veritabanında tanımlı değil. Yöneticinize başvurun.',
        };
      }

      return { success: false, error: 'Profil kaydedilemedi.' };
    }

    return {
      success: false,
      error:
        lastErrorMessage.includes('duplicate') || lastErrorMessage.includes('unique')
          ? 'Portfolyo bağlantısı çakışması; tekrar deneyin.'
          : 'Profil kaydedilemedi.',
    };
  } catch (error) {
    console.error(
      '[student-profile] updateStudentAcademicProfileAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function regenerateStudentObserverTokenAction(): Promise<{
  success: boolean;
  error?: string;
  token?: string;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const client = await getProfilesClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const newToken = crypto.randomUUID();

    const { error } = await client
      .from('profiles')
      .update({
        observer_link_token: newToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', student.userId);

    if (error) {
      console.error(
        '[student-profile] gözlemci token yenileme:',
        error.message,
      );
      if (error.code === '42703') {
        return {
          success: false,
          error:
            'Gözlemci alanı henüz veritabanında tanımlı değil. Yöneticinize başvurun.',
        };
      }
      return { success: false, error: 'Bağlantı yenilenemedi.' };
    }

    revalidatePath(STUDENT_PROFILE_PATH);
    revalidatePath(STUDENT_CONNECTIONS_PATH);
    revalidatePath(`/observe/${newToken}`);
    return { success: true, token: newToken };
  } catch (error) {
    console.error(
      '[student-profile] regenerateStudentObserverTokenAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

/** Tip dışa aktarımı (istemci importları için). */
export type { StudentGoalsContext } from '@/lib/student-profile/types';
