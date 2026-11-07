'use client';

import { Rocket, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  formatScoreRunwayValue,
  type StudentScoreRunwayViewModel,
} from '@/lib/score-runway/build-student-runway';

export interface ScoreRunwayWidgetProps {
  runway: StudentScoreRunwayViewModel | null;
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

export function ScoreRunwayWidget({ runway }: ScoreRunwayWidgetProps): ReactNode {
  if (!runway) {
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

  const { calculation, track, trackLabel, unit } = runway;
  const fmt = (n: number) => formatScoreRunwayValue(track, n);
  const monthTarget = fmt(calculation.currentMonthTarget);
  const remaining = fmt(calculation.pointsRemainingToMonthlyTarget);
  const unlocked = calculation.isMilestoneUnlocked;

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] shadow-sm shadow-black/15 backdrop-blur">
      <div className="border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Rocket className="size-3.5 text-amber-300/90" aria-hidden />
          Hedef yolculuğu & aylık koşu
        </p>
        <h3 className="mt-1 text-sm font-semibold text-slate-100">
          <span aria-hidden>🚀 </span>
          Score Runway — {trackLabel}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Sınav: {formatExamDateShort(runway.examDate)} · {calculation.monthsRemaining}{' '}
          ay · Ay {calculation.monthIndex}/{calculation.monthsRemaining}
        </p>
      </div>

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
          </p>
        </div>
      </div>
    </div>
  );
}
