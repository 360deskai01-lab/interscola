'use client';

import { Rocket, Target } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  formatScoreRunwayValue,
  type StudentScoreRunwayBundle,
  type StudentScoreRunwayViewModel,
  type ScoreRunwayTrack,
} from '@/lib/score-runway/build-student-runway';

export interface ScoreRunwayWidgetProps {
  bundle: StudentScoreRunwayBundle;
}

function formatExamDateShort(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function RunwayBody({ runway }: { runway: StudentScoreRunwayViewModel }): ReactNode {
  const { calculation, track, unit } = runway;
  const fmt = (n: number) => formatScoreRunwayValue(track, n);
  const monthTarget = fmt(calculation.currentMonthTarget);
  const remaining = fmt(calculation.pointsRemainingToMonthlyTarget);
  const unlocked = calculation.isMilestoneUnlocked;

  return (
    <div className="space-y-3 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-200">
          <Target className="mr-1.5 inline size-3.5 text-cyan-300/90" aria-hidden />
          Bu ayki sprint hedefi:{' '}
          <span className="font-semibold tabular-nums text-cyan-100">
            {monthTarget} {unit}
          </span>
        </p>
        {unlocked ? (
          <span className="inline-flex items-center rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
            🎯 Aylık hedef aşıldı!
          </span>
        ) : null}
      </div>

      <div>
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>Kalan puan (bu ay)</span>
          <span className="tabular-nums text-slate-300">
            {remaining} {unit}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-md border border-white/10 bg-slate-950/60"
          role="progressbar"
          aria-valuenow={Math.round(calculation.progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Aylık sprint ilerlemesi"
        >
          <div
            className={`h-full rounded-md transition-all ${
              unlocked
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
            }`}
            style={{ width: `${Math.round(calculation.progressPercent)}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-600">
          İlerleme: %{Math.round(calculation.progressPercent)} · Aylık basamak:{' '}
          <span className="tabular-nums text-slate-400">
            {fmt(calculation.monthlyPace)} {unit}
          </span>
          /ay
        </p>
      </div>
    </div>
  );
}

export function ScoreRunwayWidget({ bundle }: ScoreRunwayWidgetProps): ReactNode {
  const { runwayList, defaultTrack } = bundle;
  const [selectedTrack, setSelectedTrack] = useState<ScoreRunwayTrack | null>(
    defaultTrack,
  );

  useEffect(() => {
    setSelectedTrack(defaultTrack);
  }, [defaultTrack]);

  if (runwayList.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-500 backdrop-blur">
        <p className="font-medium text-slate-400">
          <span aria-hidden>🚀 </span>
          Hedef yolculuğu & aylık koşu
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          Hedef skor (SAT/IELTS), deneme sonucu ve resmi sınav takvimi
          tanımlandığında aylık sprint burada görünür.
        </p>
      </div>
    );
  }

  const active =
    runwayList.find((r) => r.track === selectedTrack) ?? runwayList[0]!;
  const showTabs = runwayList.length > 1;

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] shadow-sm shadow-black/15 backdrop-blur">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Rocket className="size-3.5 text-amber-300/90" aria-hidden />
          Hedef yolculuğu & aylık koşu
        </p>

        {showTabs ? (
          <div
            className="mt-2.5 flex flex-wrap gap-1.5"
            role="tablist"
            aria-label="Hedef sınav pisti"
          >
            {runwayList.map((item) => {
              const selected = item.track === active.track;
              return (
                <button
                  key={item.track}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSelectedTrack(item.track)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    selected
                      ? 'border-cyan-400/45 bg-cyan-500/15 text-cyan-50 shadow-sm shadow-cyan-900/20'
                      : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <span aria-hidden>{item.tabEmoji}</span>
                  {item.trackLabel}
                </button>
              );
            })}
          </div>
        ) : (
          <h3 className="mt-1 text-sm font-semibold text-slate-100">
            <span aria-hidden>{active.tabEmoji} </span>
            Score Runway — {active.trackLabel}
          </h3>
        )}

        <p className="mt-1.5 text-[11px] text-slate-500">
          Sınav: {formatExamDateShort(active.examDate)} ·{' '}
          {active.calculation.monthsRemaining} ay · Ay{' '}
          {active.calculation.monthIndex}/{active.calculation.monthsRemaining}
        </p>
      </div>

      <RunwayBody runway={active} />
    </div>
  );
}
