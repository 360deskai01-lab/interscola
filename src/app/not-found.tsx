import Link from 'next/link';
import { GraduationCap, Home, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';

export default function NotFound(): ReactNode {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-slate-950 px-5 py-16 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(99,102,241,0.22),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(217,70,239,0.12),transparent_45%)]"
      />

      <div className="relative mx-auto w-full max-w-lg text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-lg shadow-indigo-950/40">
          <SearchX className="size-8 text-indigo-300" aria-hidden />
        </div>
        <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Sayfa Bulunamadı (404)
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-400">
          Aradığınız sınav, sayfa veya kaynak mevcut değil veya taşınmış
          olabilir.
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/35 transition hover:brightness-110"
          >
            <Home className="size-4" aria-hidden />
            Ana Sayfaya Dön
          </Link>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/[0.07]"
          >
            <GraduationCap className="size-4" aria-hidden />
            Öğrenci Kokpiti
          </Link>
        </div>
      </div>
    </div>
  );
}
