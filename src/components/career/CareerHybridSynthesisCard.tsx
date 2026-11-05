'use client';

import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { HybridCareerSynthesis } from '@/lib/career-assessment/inventory-triad';

interface CareerHybridSynthesisCardProps {
  synthesis: HybridCareerSynthesis;
  progressPercent: number;
  completedStageCount: number;
  totalStages: number;
}

export function CareerHybridSynthesisCard({
  synthesis,
  progressPercent,
  completedStageCount,
  totalStages,
}: CareerHybridSynthesisCardProps): ReactNode {
  return (
    <section className="rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/10 via-slate-950/80 to-violet-500/10 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">
            <Sparkles className="size-3.5" aria-hidden />
            360° Kümülatif Yetkinlik & Kariyer Sentezi
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            Tamamlanan tüm envanterlerin birleşik sinyali (
            {completedStageCount}/{totalStages} aşama, %{progressPercent} derinlik).
          </p>
        </div>
        <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-100 tabular-nums">
          %{progressPercent} hibrit profil
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-emerald-100">
            Kategori 1 — Çekirdek eşleşmeler
          </h4>
          <p className="mt-1 text-[11px] text-slate-500">
            Baskın ilgi ve düşünme refleksine en doğal oturan bölümler
          </p>
          <ul className="mt-3 space-y-2">
            {synthesis.primaryMajors.map((major) => (
              <li
                key={major.title}
                className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5"
              >
                <p className="text-sm font-medium text-slate-100">{major.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {major.rationale}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-cyan-100">
            Kategori 2 — Çapraz & hibrit alanlar
          </h4>
          <p className="mt-1 text-[11px] text-slate-500">
            İkincil yetkinlik ve motivasyonla öne çıkabilecek alternatif disiplinler
          </p>
          <ul className="mt-3 space-y-2">
            {synthesis.secondaryMajors.map((major) => (
              <li
                key={major.title}
                className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2.5"
              >
                <p className="text-sm font-medium text-slate-100">{major.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {major.rationale}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
