'use client';

import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, Building2, RefreshCw } from 'lucide-react';

interface CoordinatorErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CoordinatorError({
  error,
  reset,
}: CoordinatorErrorProps): ReactNode {
  useEffect(() => {
    console.error('[coordinator] error boundary:', error);
  }, [error]);

  const showDigest =
    process.env.NODE_ENV !== 'development' && Boolean(error.digest);
  const showDevMessage = process.env.NODE_ENV === 'development';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-5 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-cyan-400/25 bg-cyan-500/[0.07] p-8 text-center shadow-xl shadow-cyan-950/20">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15">
          <AlertTriangle className="size-7 text-cyan-200" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-cyan-50">
          Kurumsal Portal Bağlantı Uyarısı
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Kurum verileri veya B2B raporları geçici olarak ulaşılamıyor. İşlemi
          yeniden deneyin veya koordinatör masasına dönün.
        </p>
        {showDevMessage ? (
          <p className="mt-4 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-left text-xs text-slate-400">
            {error.message}
          </p>
        ) : null}
        {showDigest ? (
          <p className="mt-4 text-xs text-slate-500">
            Destek referansı:{' '}
            <span className="font-mono text-slate-400">{error.digest}</span>
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            <RefreshCw className="size-4" aria-hidden />
            Yeniden Dene
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/coordinator';
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
          >
            <Building2 className="size-4" aria-hidden />
            Koordinatör Masasına Dön
          </button>
        </div>
      </div>
    </div>
  );
}
