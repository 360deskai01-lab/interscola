'use client';

import { GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';

import type { CoordinatorA4CaieAoSummary } from '@/lib/b2b/coordinator-a4-caie-ao';

interface TeacherClassCaieAoChipProps {
  summary: CoordinatorA4CaieAoSummary;
  branchLabel?: string | null;
}

export function TeacherClassCaieAoChip({
  summary,
  branchLabel,
}: TeacherClassCaieAoChipProps): ReactNode {
  const scope = branchLabel?.trim()
    ? `${branchLabel.trim()} şubesi`
    : 'Sınıfınız';

  return (
    <article className="rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/10 p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl border border-indigo-300/40 bg-indigo-500/20">
            <GraduationCap className="size-4 text-indigo-100" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-indigo-50">
              Şube Cambridge AO Ortalaması
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">{scope}</p>
          </div>
        </div>
        <p className="text-sm font-bold text-amber-200">
          {summary.showBlock ? summary.cambridgeGradeHeadline : '—'}
        </p>
      </div>

      {summary.showBlock ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {summary.rows.map((row) => (
            <li
              key={row.key}
              className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                AO
                {row.key === 'ao1_knowledge'
                  ? '1'
                  : row.key === 'ao2_application'
                    ? '2'
                    : '3'}
              </p>
              <p className="mt-1 text-xs text-slate-300">{row.label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                {row.pointsDisplay}
                <span className="ml-1.5 text-xs font-normal text-indigo-200">
                  ({row.percentDisplay})
                </span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          CAIE sınavı çözülmüş ve AO metrikleri kayıtlı öğrenci yok. Öğrenciler
          Cambridge rubrik sınavını tamamladıkça ortalama burada görünür.
        </p>
      )}

      {summary.showBlock ? (
        <p className="mt-3 text-[10px] text-slate-500">
          {summary.attemptCount} tamamlanmış CAIE denemesi üzerinden hesaplandı.
        </p>
      ) : null}
    </article>
  );
}
