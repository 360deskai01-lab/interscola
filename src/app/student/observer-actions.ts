'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getCurrentProfile } from '@/lib/auth';
import { absoluteUrl } from '@/lib/seo/site-url';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import {
  MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI,
  OBSERVER_MAX_ACTIVE_TOKEN_USER_MESSAGE,
  shouldRejectObserverTokenCreation,
} from '@/lib/observer/observer-token-limits';

const TOKEN_TTL_DAYS = 90;
const HEX_TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

const STUDENT_PATHS = [
  '/student/dashboard',
  '/student/connections',
  '/student/profile',
] as const;

export type StudentObserverTokenRow = {
  id: string;
  label: string | null;
  token: string;
  isActive: boolean;
  expiresAt: string;
  lastAccessedAt: string | null;
  createdAt: string;
  observeUrl: string;
};

async function requireApprovedStudent(): Promise<{ userId: string } | null> {
  const current = await getCurrentProfile();
  if (!current) return null;
  if (current.profile.role !== 'student') return null;
  if (current.profile.status !== 'approved') return null;
  return { userId: current.user.id };
}

async function getStudentScopedClient() {
  const admin = getSupabaseAdmin(PROFILES_SCHEMA);
  if (admin) return admin;
  return await getSupabaseServer(PROFILES_SCHEMA);
}

/** Veli token üretimi: yalnızca çerezli SSR oturumu (RPC `auth.uid()` kalkanı). */
async function getObserverSessionClient() {
  return await getSupabaseServer(PROFILES_SCHEMA);
}

function mapTokenRow(row: {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  expires_at: string;
  last_accessed_at: string | null;
  created_at: string;
}): StudentObserverTokenRow {
  return {
    id: row.id,
    token: row.token,
    label: row.label,
    isActive: row.is_active,
    expiresAt: row.expires_at,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
    observeUrl: absoluteUrl(`/observe/${row.token}`),
  };
}

function isMissingObserverTable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42703' ||
    error.code === 'PGRST205' ||
    (error.message ?? '').toLowerCase().includes('student_observer_tokens')
  );
}

function isObserverRpcUnavailable(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const haystack = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    haystack.includes('create_student_observer_token_atomic')
  );
}

type ObserverTokenDbRow = {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  expires_at: string;
  last_accessed_at: string | null;
  created_at: string;
};

type CreateObserverTokenRpcPayload = {
  success?: boolean;
  error?: string;
  message?: string;
  row?: ObserverTokenDbRow;
};

function parseRpcObserverRow(
  raw: unknown,
): ObserverTokenDbRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.token !== 'string' ||
    typeof row.is_active !== 'boolean' ||
    typeof row.expires_at !== 'string' ||
    typeof row.created_at !== 'string'
  ) {
    return null;
  }
  return {
    id: row.id,
    token: row.token,
    label: typeof row.label === 'string' ? row.label : null,
    is_active: row.is_active,
    expires_at: row.expires_at,
    last_accessed_at:
      typeof row.last_accessed_at === 'string' ? row.last_accessed_at : null,
    created_at: row.created_at,
  };
}

function finishCreateSuccess(
  token: string,
  row: StudentObserverTokenRow,
): {
  success: true;
  token: string;
  observeUrl: string;
  row: StudentObserverTokenRow;
} {
  for (const path of STUDENT_PATHS) {
    revalidatePath(path);
  }
  revalidatePath(`/observe/${token}`);
  return {
    success: true,
    token,
    observeUrl: row.observeUrl,
    row,
  };
}

/** RPC yoksa veya hata verirse: manuel sayım + insert (TOCTOU riski bilinçli fallback). */
async function createObserverTokenFallback(
  client: NonNullable<Awaited<ReturnType<typeof getObserverSessionClient>>>,
  studentId: string,
  token: string,
  label: string | null,
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  token?: string;
  observeUrl?: string;
  row?: StudentObserverTokenRow;
}> {
  const nowIso = new Date().toISOString();
  const { count: activeCount, error: countError } = await client
    .from('student_observer_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('is_active', true)
    .gt('expires_at', nowIso);

  if (countError) {
    console.error('[observer] aktif token sayımı (fallback):', countError.message);
    if (!isMissingObserverTable(countError)) {
      return { success: false, error: 'Bağlantı kotası kontrol edilemedi.' };
    }
  } else if (shouldRejectObserverTokenCreation(activeCount ?? 0)) {
    return {
      success: false,
      error: MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI,
      message: OBSERVER_MAX_ACTIVE_TOKEN_USER_MESSAGE,
    };
  }

  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await client
    .from('student_observer_tokens')
    .insert({
      student_id: studentId,
      token,
      label,
      expires_at: expiresAt,
      is_active: true,
    })
    .select(
      'id, token, label, is_active, expires_at, last_accessed_at, created_at',
    )
    .single();

  if (error) {
    console.error('[observer] token oluşturma (fallback):', error.message);
    if (isMissingObserverTable(error)) {
      return {
        success: false,
        error:
          'Veli bağlantı tablosu henüz kurulmadı. Yöneticinize başvurun.',
      };
    }
    return { success: false, error: 'Veli takip linki oluşturulamadı.' };
  }

  const row = mapTokenRow(data as ObserverTokenDbRow);
  return finishCreateSuccess(token, row);
}

export async function createObserverTokenAction(input?: {
  label?: string;
}): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  token?: string;
  observeUrl?: string;
  row?: StudentObserverTokenRow;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const sessionClient = await getObserverSessionClient();
    if (!sessionClient) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const token = crypto.randomBytes(16).toString('hex');
    if (!HEX_TOKEN_PATTERN.test(token)) {
      return { success: false, error: 'Token üretilemedi.' };
    }

    const label = input?.label?.trim()
      ? input.label.trim().slice(0, 80)
      : 'Veli / Gözlemci';

    const rpc = await sessionClient.rpc('create_student_observer_token_atomic', {
      p_student_id: student.userId,
      p_token: token,
      p_label: label,
      p_expires_in_days: TOKEN_TTL_DAYS,
    });

    if (!rpc.error && rpc.data && typeof rpc.data === 'object') {
      const payload = rpc.data as CreateObserverTokenRpcPayload;
      if (payload.success === false) {
        if (payload.error === MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI) {
          return {
            success: false,
            error: MAKSIMUM_AKTIF_TOKEN_LIMITI_ASILDI,
            message:
              payload.message?.trim() || OBSERVER_MAX_ACTIVE_TOKEN_USER_MESSAGE,
          };
        }
        if (payload.error === 'UNAUTHORIZED') {
          return {
            success: false,
            error: 'Bu işlem için geçerli öğrenci oturumu gerekir.',
          };
        }
      }
      if (payload.success === true) {
        const dbRow = parseRpcObserverRow(payload.row);
        if (dbRow) {
          const mapped = mapTokenRow(dbRow);
          return finishCreateSuccess(token, mapped);
        }
      }
    }

    if (rpc.error && isObserverRpcUnavailable(rpc.error)) {
      console.warn(
        '[observer] atomik RPC kullanılamıyor, oturumlu fallback:',
        rpc.error.message,
      );
      return createObserverTokenFallback(
        sessionClient,
        student.userId,
        token,
        label === 'Veli / Gözlemci' ? null : label,
      );
    }

    if (rpc.error) {
      console.error('[observer] atomik RPC:', rpc.error.message);
      return {
        success: false,
        error: 'Veli takip linki oluşturulamadı.',
      };
    }

    return createObserverTokenFallback(
      sessionClient,
      student.userId,
      token,
      label === 'Veli / Gözlemci' ? null : label,
    );
  } catch (error) {
    console.error(
      '[observer] createObserverTokenAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function revokeObserverTokenAction(tokenId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const id = tokenId.trim();
    if (!id) {
      return { success: false, error: 'Geçersiz bağlantı kimliği.' };
    }

    const client = await getStudentScopedClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { error } = await client
      .from('student_observer_tokens')
      .update({
        is_active: false,
      })
      .eq('id', id)
      .eq('student_id', student.userId);

    if (error) {
      console.error('[observer] token iptal:', error.message);
      if (isMissingObserverTable(error)) {
        return {
          success: false,
          error:
            'Veli bağlantı tablosu henüz kurulmadı. Yöneticinize başvurun.',
        };
      }
      return { success: false, error: 'Bağlantı iptal edilemedi.' };
    }

    for (const path of STUDENT_PATHS) {
      revalidatePath(path);
    }
    return { success: true };
  } catch (error) {
    console.error(
      '[observer] revokeObserverTokenAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}

export async function listStudentObserverTokensAction(): Promise<{
  success: boolean;
  error?: string;
  tokens?: StudentObserverTokenRow[];
}> {
  try {
    const student = await requireApprovedStudent();
    if (!student) {
      return {
        success: false,
        error: 'Bu işlem için onaylı öğrenci oturumu gerekir.',
      };
    }

    const client = await getStudentScopedClient();
    if (!client) {
      return { success: false, error: 'Veritabanı bağlantısı kurulamadı.' };
    }

    const { data, error } = await client
      .from('student_observer_tokens')
      .select(
        'id, token, label, is_active, expires_at, last_accessed_at, created_at',
      )
      .eq('student_id', student.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[observer] token listesi:', error.message);
      if (isMissingObserverTable(error)) {
        return { success: true, tokens: [] };
      }
      return { success: false, error: 'Bağlantı listesi okunamadı.' };
    }

    const tokens = (data ?? []).map((row) =>
      mapTokenRow(
        row as {
          id: string;
          token: string;
          label: string | null;
          is_active: boolean;
          expires_at: string;
          last_accessed_at: string | null;
          created_at: string;
        },
      ),
    );

    return { success: true, tokens };
  } catch (error) {
    console.error(
      '[observer] listStudentObserverTokensAction:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false, error: 'Beklenmeyen bir hata oluştu.' };
  }
}
