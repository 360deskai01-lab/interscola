import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

loadEnv({ path: resolve(process.cwd(), '.env.local') });

if (!process.env.SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export const E2E_STUDENT_EMAIL =
  process.env.E2E_STUDENT_EMAIL?.trim() || 'test.ogrenci@interscola.test';

export const E2E_STUDENT_PASSWORD =
  process.env.E2E_STUDENT_PASSWORD?.trim() || 'Test2026!#';

const SENSITIVE_BODY_PATTERNS = [
  /"password"\s*:/i,
  /password_hash/i,
  /service_role/i,
  /refresh_token/i,
  /access_token/i,
  /SUPABASE_SERVICE_ROLE/i,
] as const;

function getServiceRoleClient() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'E2E magic link için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli (.env.local).',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function resolveE2EBaseUrl(): string {
  return (
    process.env.PLAYWRIGHT_BASE_URL?.trim()?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '') ||
    'http://localhost:3000'
  );
}

export async function resolveMagicLinkForEmail(email: string): Promise<string> {
  const client = getServiceRoleClient();
  const redirectTo = resolveE2EBaseUrl();
  const { data, error } = await client.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });
  if (error) {
    throw new Error(`Magic link üretilemedi (${email}): ${error.message}`);
  }
  const link = data.properties?.action_link;
  if (!link) {
    throw new Error(`Magic link boş döndü (${email}).`);
  }
  return link;
}

export async function resolveApprovedAdminEmail(): Promise<string> {
  const envEmail = process.env.E2E_ADMIN_EMAIL?.trim();
  if (envEmail) return envEmail;

  const client = getServiceRoleClient();
  const { data, error } = await client
    .from('profiles')
    .select('email')
    .eq('role', 'admin')
    .eq('status', 'approved')
    .not('email', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Admin e-posta sorgusu: ${error.message}`);
  }
  const email = (data as { email?: string | null } | null)?.email?.trim();
  if (!email) {
    throw new Error(
      'Onaylı admin profili bulunamadı. E2E_ADMIN_EMAIL tanımlayın veya admin oluşturun.',
    );
  }
  return email;
}

export async function loginViaMagicLink(page: Page, email: string): Promise<void> {
  const service = getServiceRoleClient();
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: resolveE2EBaseUrl() },
  });
  if (error) {
    throw new Error(`Magic link üretilemedi (${email}): ${error.message}`);
  }

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error(`hashed_token alınamadı (${email}).`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY gerekli.');
  }

  await page.goto('/auth/login');
  const verifyMessage = await page.evaluate(
    async (payload: {
      supabaseUrl: string;
      anonKey: string;
      tokenHash: string;
      email: string;
    }) => {
      const dynamicImport = new Function(
        'specifier',
        'return import(specifier)',
      ) as (specifier: string) => Promise<{
        createBrowserClient: (
          url: string,
          key: string,
        ) => {
          auth: {
            verifyOtp: (input: {
              email?: string;
              token_hash: string;
              type: string;
            }) => Promise<{ error: { message: string } | null }>;
          };
        };
      }>;
      const mod = await dynamicImport(
        'https://cdn.jsdelivr.net/npm/@supabase/ssr@0.12.7/+esm',
      );
      const client = mod.createBrowserClient(
        payload.supabaseUrl,
        payload.anonKey,
      );
      const { error: verifyError } = await client.auth.verifyOtp({
        token_hash: payload.tokenHash,
        type: 'email',
      });
      return verifyError?.message ?? null;
    },
    { supabaseUrl, anonKey, tokenHash, email },
  );

  if (verifyMessage) {
    throw new Error(`verifyOtp başarısız (${email}): ${verifyMessage}`);
  }

  const hasUser = await page.evaluate(async () => {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    const body = (await res.json()) as { user?: { id?: string } };
    return Boolean(body.user?.id);
  });
  if (!hasUser) {
    throw new Error(`Oturum çerezi doğrulanamadı (${email}).`);
  }
}

export async function loginWithPasswordFallbackMagic(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/auth/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click();

  try {
    await page.waitForURL(
      (url) => !url.pathname.startsWith('/auth/login'),
      { timeout: 12_000 },
    );
    return;
  } catch {
    await loginViaMagicLink(page, email);
  }
}

export function attachSensitiveResponseGuard(page: Page): {
  assertNoLeaks: () => void;
  dispose: () => void;
} {
  const violations: string[] = [];

  const handler = async (response: import('@playwright/test').Response) => {
    const url = response.url();
    if (!url.includes('/observe/')) return;
    const contentType = response.headers()['content-type'] ?? '';
    if (
      !contentType.includes('json') &&
      !contentType.includes('text') &&
      !contentType.includes('html')
    ) {
      return;
    }
    try {
      const body = await response.text();
      for (const pattern of SENSITIVE_BODY_PATTERNS) {
        if (pattern.test(body)) {
          violations.push(`${url} → ${pattern.source}`);
        }
      }
    } catch {
      /* binary / aborted */
    }
  };

  page.on('response', handler);

  return {
    assertNoLeaks: () => {
      if (violations.length > 0) {
        throw new Error(
          `Hassas veri sızıntısı: ${violations.slice(0, 5).join('; ')}`,
        );
      }
    },
    dispose: () => {
      page.off('response', handler);
    },
  };
}

export function extractHexTokenFromObserveUrl(url: string): string | null {
  const match = url.match(/\/observe\/([a-f0-9]{32})/i);
  return match?.[1] ?? null;
}
