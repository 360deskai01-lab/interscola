import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ExternalLink, Trophy } from 'lucide-react';
import { getSupabasePublicAnon } from '@/lib/supabase/public-anon';

export const instant = false;

const SLUG_PATTERN = /^[a-z0-9]{8,24}$/i;

/** `public.get_public_portfolio` dönüşü (yalnızca güvenli alanlar). */
interface PublicPortfolioSnapshot {
  display_name: string;
  high_school_name: string | null;
  external_portfolio_url: string | null;
  items: {
    id: string | null;
    title: string | null;
    organization: string | null;
    category: string | null;
  }[];
}

/** Yalnızca http(s) bağlantılar href olarak render edilir. */
function safeExternalHref(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function Unavailable({ message }: { message: string }): ReactNode {
  return (
    <div className="min-h-dvh bg-slate-950 p-8 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

export default async function PublicPortfolioPage(props: {
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  await connection();

  const { slug } = await props.params;
  if (!SLUG_PATTERN.test(slug)) notFound();

  const client = getSupabasePublicAnon('public');
  if (!client) {
    return (
      <Unavailable message="Portfolyo herkese açık görünümü şu an kullanılamıyor." />
    );
  }

  const { data, error } = await client.rpc('get_public_portfolio', {
    p_slug: slug,
  });

  if (error) {
    console.error('[portfolio/public] RPC hatası:', error.code, error.message);
    return (
      <Unavailable message="Portfolyo herkese açık görünümü şu an kullanılamıyor." />
    );
  }
  if (!data) notFound();

  const snapshot = data as PublicPortfolioSnapshot;
  const items = Array.isArray(snapshot.items) ? snapshot.items : [];
  const externalHref = safeExternalHref(snapshot.external_portfolio_url);

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_30%_-10%,rgba(99,102,241,0.15),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-indigo-500/20 ring-1 ring-indigo-400/25">
              <Trophy className="size-6 text-indigo-200" />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-indigo-300/90 uppercase">
                Herkese açık dijital portfolyo
              </p>
              <h1 className="text-2xl font-semibold text-white">
                {snapshot.display_name}
              </h1>
              {snapshot.high_school_name ? (
                <p className="mt-1 text-sm text-slate-400">
                  {snapshot.high_school_name}
                </p>
              ) : null}
            </div>
          </div>
          {externalHref ? (
            <a
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-sm text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              Harici site
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <h2 className="text-sm font-medium text-slate-200">
            Aktiviteler & girişler
          </h2>
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Henüz liste için paylaşılmış aktivite girilmemiş.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {items.map((item, index) => (
                <li
                  key={item.id ?? `item-${index}`}
                  className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3"
                >
                  <p className="font-medium text-slate-100">
                    {item.title ?? 'Aktivite'}
                  </p>
                  {item.organization ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.organization}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
