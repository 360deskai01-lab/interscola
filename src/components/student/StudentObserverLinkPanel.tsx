'use client';

import Link from 'next/link';
import { Copy, Shield } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { absoluteUrl } from '@/lib/seo/site-url';

interface StudentObserverLinkPanelProps {
  observerToken: string;
}

export function StudentObserverLinkPanel({
  observerToken,
}: StudentObserverLinkPanelProps): ReactNode {
  const [copied, setCopied] = useState(false);

  const observerUrl = useMemo(() => {
    const t = observerToken.trim();
    if (!t) return '';
    return absoluteUrl(`/observe/${t}`);
  }, [observerToken]);

  async function handleCopy() {
    if (!observerUrl) return;
    try {
      await navigator.clipboard.writeText(observerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano reddi — sessiz */
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Shield className="size-4 text-indigo-200" aria-hidden />
        <p className="text-sm font-medium text-indigo-50">
          Veli / danışman takip linki
        </p>
        <span className="text-[10px] text-indigo-200/70">Salt okunur</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Gözlemci kanefi: skor runway, denemeler ve aktivite özeti — giriş gerekmez.
      </p>
      {observerUrl ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 font-mono text-[11px] text-slate-300">
            {observerUrl}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-indigo-400/35 bg-indigo-500/20 px-4 py-2 text-xs font-semibold text-indigo-50 transition hover:bg-indigo-500/30"
          >
            <Copy className="size-3.5" />
            {copied ? 'Kopyalandı' : 'Veli / Danışman Takip Linki Kopyala'}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-200/90">
          Link henüz oluşturulmadı.{' '}
          <Link
            href="/student/connections"
            className="underline decoration-indigo-400/50 underline-offset-2 hover:text-indigo-100"
          >
            Bağlantılarım
          </Link>{' '}
          sayfasından üretebilirsin.
        </p>
      )}
    </div>
  );
}
