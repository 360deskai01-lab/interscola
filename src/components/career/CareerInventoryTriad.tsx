'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { CareerRadarChart } from '@/components/student/CareerRadarChart';
import type { CareerInventoryCardModel } from '@/lib/career-assessment/inventory-triad';
import { radarSeriesHasSignal } from '@/lib/assessment/radar-series';

interface CareerInventoryTriadProps {
  cards: CareerInventoryCardModel[];
  compassHref?: string;
  compact?: boolean;
}

export function CareerInventoryTriad({
  cards,
  compassHref = '/career-compass',
  compact = false,
}: CareerInventoryTriadProps): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.id}
          className="flex flex-col rounded-2xl border border-white/10 bg-slate-950/55 p-3 sm:p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-100">{card.title}</p>
              <p className="text-[11px] text-slate-500">{card.subtitle}</p>
            </div>
            {card.completed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                <CheckCircle2 className="size-3" aria-hidden />
                Tamam
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100">
                <CircleDashed className="size-3" aria-hidden />
                Eksik
              </span>
            )}
          </div>

          <div className="mt-3 min-h-[140px] flex-1">
            {card.completed && radarSeriesHasSignal(card.radarData) ? (
              <CareerRadarChart
                data={card.radarData}
                className={compact ? 'h-36 w-full' : 'h-40 w-full'}
              />
            ) : (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-indigo-400/25 bg-indigo-500/5 px-3 text-center">
                <p className="text-xs text-slate-400">
                  Henüz veri yok — envanter tamamlandığında mini radar burada
                  görünür.
                </p>
                <Link
                  href={compassHref}
                  className="mt-3 inline-flex rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 transition hover:bg-indigo-500/25"
                >
                  {card.missingCtaLabel} ({card.missingDepthHint})
                </Link>
              </div>
            )}
          </div>

          {card.completed && card.topDimensions.length > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-white/10 pt-3 text-[11px] text-slate-400">
              {card.topDimensions.map((dim) => (
                <li key={dim.label} className="flex justify-between gap-2">
                  <span className="truncate text-slate-300">{dim.label}</span>
                  <span className="shrink-0 tabular-nums text-indigo-200">
                    %{dim.percent}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  );
}
