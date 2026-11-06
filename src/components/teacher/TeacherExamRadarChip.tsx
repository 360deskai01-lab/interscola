'use client';

import { Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { OfficialExamScheduleSummary } from '@/types/exam-radar';

export interface TeacherExamRadarChipProps {
  exam: OfficialExamScheduleSummary | null;
}

export function TeacherExamRadarChip({
  exam,
}: TeacherExamRadarChipProps): ReactNode {
  if (!exam) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-violet-400/25 bg-violet-500/10 px-4 py-3 backdrop-blur">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-violet-500/25">
        <Timer className="size-4 text-violet-100" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-violet-200/85">
          En yakın resmi sınav
        </p>
        <p className="truncate text-sm font-semibold text-slate-100">
          {exam.examName}
          <span className="text-slate-400"> — </span>
          <span className="tabular-nums text-violet-100">
            {exam.daysRemaining} gün kaldı
          </span>
        </p>
      </div>
    </div>
  );
}
