'use client';

import type { ReactNode } from 'react';
import { Compass } from 'lucide-react';

import { CareerRadarChart } from '@/components/student/CareerRadarChart';
import type { StudentCareerInsightForTeacher } from '@/lib/student-dashboard/teacher-career-insight';

interface TeacherStudentCareerSnapshotProps {
  insight: StudentCareerInsightForTeacher;
}

export function TeacherStudentCareerSnapshot({
  insight,
}: TeacherStudentCareerSnapshotProps): ReactNode {
  if (!insight.hasAssessment) {
    return (
      <div className="rounded-xl border border-dashed border-violet-400/35 bg-violet-500/5 p-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-500/40 bg-slate-900/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          <Compass className="size-3.5" aria-hidden />
          Envanter bekleniyor
        </span>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Öğrenci henüz 360° Kariyer Pusulası envanterini tamamlamadı.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-violet-200">Holland (RIASEC) baskın kodlar</p>
            <p className="mt-1 text-xl font-bold tracking-wide text-slate-50">
              {insight.riasecDominantCodes ?? insight.hollandCode ?? '—'}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {insight.hollandTitle ?? 'Profil özeti'}
            </p>
          </div>
          {typeof insight.progressPercent === 'number' ? (
            <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] tabular-nums text-violet-100">
              Pusula %{insight.progressPercent}
            </span>
          ) : null}
        </div>
      </div>

      {insight.bigFiveSummary ? (
        <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-3">
          <p className="text-xs font-medium text-indigo-200">Big Five özet dengesi</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-200">
            {insight.bigFiveSummary}
          </p>
        </div>
      ) : null}

      {insight.viaCognitiveStrengths.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-500">
            VIA bilişsel güçlü yönler
          </p>
          <ul className="mt-2 space-y-1">
            {insight.viaCognitiveStrengths.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {insight.radarData.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">RIASEC radar</p>
          <CareerRadarChart data={insight.radarData} />
        </div>
      ) : null}

      {insight.topTraits.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-500">Baskın ilgi alanları</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {insight.topTraits.map((trait) => (
              <span
                key={trait}
                className="rounded-full border border-indigo-400/30 bg-indigo-500/12 px-2.5 py-0.5 text-[11px] text-indigo-100"
              >
                {trait}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
