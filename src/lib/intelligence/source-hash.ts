import { createHash } from 'crypto';

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

const FETCH_USER_AGENT =
  'Interscola-IntelBot/1.0 (source-change-monitor; +https://interscola.app)';

/** Hash karşılaştırmasında gürültüyü azaltmak için basit HTML normalizasyonu. */
export function normalizeSourceHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashNormalizedSourceContent(normalized: string): string {
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

export function hashSourceHtml(html: string): string {
  return hashNormalizedSourceContent(normalizeSourceHtml(html));
}

export async function fetchSourceDocumentText(
  sourceUrl: string,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl.trim());
  } catch {
    return { ok: false, error: 'Geçersiz kaynak URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Kaynak URL yalnızca http(s) olabilir.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': FETCH_USER_AGENT,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const text = await response.text();
    if (!text.trim()) {
      return { ok: false, error: 'Boş yanıt gövdesi.' };
    }

    return { ok: true, text };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: 'İstek zaman aşımına uğradı.' };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
