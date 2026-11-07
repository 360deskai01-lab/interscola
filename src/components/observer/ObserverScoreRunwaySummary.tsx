'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  formatScoreRunwayValue,
  type ScoreRunwayTrack,
  type StudentScoreRunwayBundle,
} from '@/lib/score-runway/build-student-runway';

export function ObserverScoreRunwaySummary({
  bundle,
}: {
  bundle: StudentScoreRunwayBundle;
}): ReactNode {
  const { runwayList, defaultTrack } = bundle;
  const [track, setTrack] = useState<ScoreRunwayTrack | null>(defaultTrack);

  useEffect(() => {
    setTrack(defaultTrack);
  }, [defaultTrack]);

  if (runwayList.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Hedef skor veya deneme sonucu henüz yeterli değil; runway özeti oluşturulamadı.
      </p>
    );
  }

  const active =
    runwayList.find((row) => row.track === track) ?? runwayList[0]!;
  const showTabs = runwayList.length > 1;
  const fmt = (n: number) => formatScoreRunwayValue(active.track, n);

  return (
    <div className="space-y-3">
      {showTabs ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Score Runway özeti"
        >
          {runwayList.map((item) => {
            const selected = item.track === active.track;
            return (
              <button
                key={item.track}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTrack(item.track)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  selected
                    ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-50'
                    : 'border-white/10 bg-white/[0.04] text-slate-400'
                }`}
              >
                <span aria-hidden>{item.tabEmoji}</span>
                {item.trackLabel}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-200">
          <span aria-hidden>{active.tabEmoji} </span>
          {active.trackLabel}
        </p>
      )}

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            Hedef
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-100">
            {fmt(active.targetScore)} {active.unit}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            Güncel seviye
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-cyan-100">
            {fmt(active.currentScore)} {active.unit}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-slate-500">
            Bu ayki sprint
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-emerald-100">
            {fmt(active.calculation.currentMonthTarget)} {active.unit}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] text-slate-500">
        Aylık basamak:{' '}
        <span className="tabular-nums text-slate-300">
          {fmt(active.calculation.monthlyPace)} {active.unit}/ay
        </span>
        {' · '}
        Sprint ilerlemesi: %{Math.round(active.calculation.progressPercent)}
      </p>
    </div>
  );
}
