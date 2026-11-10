/**
 * Otonom Hard E2E — canlı dev sunucu + headless Chromium.
 *
 * Ortam (.env.local): NEXT_PUBLIC_SUPABASE_* + SUPABASE_SERVICE_ROLE_KEY
 * İsteğe bağlı: E2E_STUDENT_EMAIL, E2E_STUDENT_PASSWORD, E2E_ADMIN_EMAIL, PLAYWRIGHT_BASE_URL
 */
import { expect, test } from '@playwright/test';
import {
  attachSensitiveResponseGuard,
  E2E_STUDENT_EMAIL,
  E2E_STUDENT_PASSWORD,
  extractHexTokenFromObserveUrl,
  loginViaMagicLink,
  loginWithPasswordFallbackMagic,
  resolveApprovedAdminEmail,
} from './e2e/session';

test.describe.configure({ mode: 'serial' });

let sharedObserveToken: string | null = null;

async function revokeAllActiveObserverLinks(page: import('@playwright/test').Page) {
  const panel = page.getByText('Veli / Gözlemci Bağlantısı').locator('..').locator('..');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const revoke = panel.getByRole('button', { name: 'İptal et' });
    if ((await revoke.count()) === 0) break;
    await revoke.first().click();
    await expect(page.getByRole('button', { name: 'Yeni Veli Takip Linki Üret' }))
      .toBeEnabled({ timeout: 45_000 })
      .catch(() => undefined);
  }
}

test('TEST 1 — Observer token üretimi ve 5 aktif kota', async ({ page }) => {
  await loginWithPasswordFallbackMagic(
    page,
    E2E_STUDENT_EMAIL,
    E2E_STUDENT_PASSWORD,
  );

  await page.goto('/student/connections');
  await expect(page.getByText('Veli / Gözlemci Bağlantısı')).toBeVisible({
    timeout: 45_000,
  });

  await revokeAllActiveObserverLinks(page);

  const createBtn = page.getByRole('button', {
    name: 'Yeni Veli Takip Linki Üret',
  });

  const activeLinkCount = () =>
    page.getByRole('button', { name: 'İptal et' }).count();

  while ((await activeLinkCount()) < 5) {
    const before = await activeLinkCount();
    await expect(createBtn).toBeEnabled();
    await createBtn.click();
    await expect
      .poll(activeLinkCount, { timeout: 60_000 })
      .toBeGreaterThan(before);
  }

  const monoTexts = await page.locator('.font-mono').allTextContents();
  for (const line of monoTexts) {
    const hit =
      extractHexTokenFromObserveUrl(line) ??
      line.match(/[a-f0-9]{32}/i)?.[0] ??
      null;
    if (hit) {
      sharedObserveToken = hit;
      break;
    }
  }
  expect(sharedObserveToken).toMatch(/^[a-f0-9]{32}$/i);

  await expect(
    page.getByText(/Maksimum 5 aktif bağlantı sınırına ulaşıldı/i),
  ).toBeVisible();
  await expect(createBtn).toBeDisabled();

  await createBtn.click({ force: true });
  await expect(createBtn).toBeDisabled();
});

test('TEST 2 — Veli zero-leak ve rapor render', async ({ browser }) => {
  test.skip(!sharedObserveToken, 'TEST 1 token üretmedi.');

  const context = await browser.newContext();
  const page = await context.newPage();
  const guard = attachSensitiveResponseGuard(page);

  await page.goto(`/observe/${sharedObserveToken}`);

  await expect(page.getByRole('heading', { name: 'Veli / Gözlemci Görünümü' })).toBeVisible({
    timeout: 45_000,
  });
  await expect(
    page.getByText(/Weakness Ledger|Odaklanılması Gereken/i),
  ).toBeVisible();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText.toLowerCase()).not.toContain('password_hash');
  expect(bodyText).not.toMatch(/service_role/i);

  guard.assertNoLeaks();
  guard.dispose();
  await context.close();
});

test('TEST 3 — Admin → koordinatör masası ve kota düğmesi', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const adminEmail = await resolveApprovedAdminEmail();
  const adminPassword = process.env.E2E_ADMIN_PASSWORD?.trim();
  if (adminPassword) {
    await loginWithPasswordFallbackMagic(page, adminEmail, adminPassword);
  } else {
    await loginViaMagicLink(page, adminEmail);
  }

  await page.goto('/admin/dashboard');
  await expect(page.getByText('Yönetim', { exact: true })).toBeVisible({
    timeout: 45_000,
  });

  await page.getByRole('link', { name: /Koordinatör Masası \(B2B\)/i }).click();
  await page.waitForURL('**/coordinator**', { timeout: 45_000 });

  await expect(page.getByRole('button', { name: 'Kotaları güncelle' })).toBeVisible({
    timeout: 45_000,
  });
  await context.close();
});

test('TEST 4 — A-Level vitrin, misafir çözüm, Grade / AO sonucu', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/test-et/a-level');
  await expect(
    page.getByRole('heading', { name: /CAIE|Psychology|A-Level/i }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/AO1|AO2|AO3/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Ücretsiz Teşhis Testini Başlat' }).click();
  await page.waitForURL('**/test-et/a-level/solve**', { timeout: 45_000 });

  await expect(page.getByLabel('Soru 1')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/Soru\s+1\s+\//)).toBeVisible();

  await page.evaluate(() => {
    const record = {
      curriculum: 'CAIE',
      slug: 'a-level',
      completedAt: new Date().toISOString(),
      headlineScore: 'Grade B',
      summary:
        'AO1/AO2/AO3 dağılımınız hesaplandı — eksik kazanım raporu hesabınızda.',
      answers: { 'caie-andrade-mcq1': 'B' },
      lockedTeaser: {
        questionBreakdown: [
          {
            questionId: 'caie-andrade-mcq1',
            questionNumber: 1,
            label: 'Soru 1',
            status: 'correct',
          },
        ],
        rubricBreakdown: [
          { key: 'ao1', label: 'AO1 Knowledge', score: '12/20' },
          { key: 'ao2', label: 'AO2 Application', score: '10/20' },
          { key: 'ao3', label: 'AO3 Evaluation', score: '11/20' },
        ],
        weakTopics: ['Working memory', 'Laboratory validity'],
      },
    };
    window.localStorage.setItem(
      'interscola_guest_diagnostic',
      JSON.stringify(record),
    );
  });

  await page.goto('/test-et/a-level/results');
  await expect(page.getByText(/Grade\s+B/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/AO1\/AO2\/AO3/i)).toBeVisible();
  await expect(page.getByText(/AO1 Knowledge/i)).toBeVisible();
  await context.close();
});
