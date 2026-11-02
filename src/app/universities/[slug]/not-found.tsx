import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export default function UniversityNotFound(): ReactNode {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <h1 className="text-xl font-semibold">Üniversite bulunamadı</h1>
      <p className="mt-2 max-w-md text-center text-sm text-slate-400">
        Aradığınız rehber sayfası mevcut değil veya taşınmış olabilir.
      </p>
      <Link
        href="/universities"
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06]"
      >
        <ArrowLeft className="size-4" />
        Tüm Üniversitelere Dön
      </Link>
    </div>
  );
}
