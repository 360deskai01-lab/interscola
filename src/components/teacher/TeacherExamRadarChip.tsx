'use client';

import { Timer } from 'lucide-react';
import type { ReactNode } from 'react';
import type { OfficialExamScheduleSummary } from '@/types/exam-radar';

export interface TeacherExamRadarChipProps {
  exam: OfficialExamScheduleSummary | null;
}

/**
 * Genel Bakış: resmi sınav radarı — veri yokken de bilgilendirme çipi kalır.
 */
export function TeacherExamRadarChip({
  exam,
}: TeacherExamRadarChipProps): ReactNode {
  const activeExamLabel = exam?.examName?.trim()
    ? exam.examName.trim()
    : 'Yakın tarihte yayımlanmış oturum yok';

  if (!exam) {
    return (
      <div
        className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur"
        role="status"
        aria-live="polite"
      >
        <span
          className="grid size-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-base leading-none"
          aria-hidden
        >
          🎯
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-slate-100">
            <span aria-hidden>🎯 </span>
            Resmi Sınav Takvimi:{' '}
            <span className="font-medium text-slate-300">{activeExamLabel}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Takvim güncellendiğinde en yakın oturum ve geri sayım burada
            görünecek.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3.5 shadow-sm shadow-black/20 backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md border border-violet-400/20 bg-violet-500/15">
        <Timer className="size-4 text-violet-200" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Resmi sınav radarı
        </p>
        <p className="truncate text-sm font-semibold text-slate-100">
          <span aria-hidden>🎯 </span>
          Resmi Sınav Takvimi:{' '}
          <span className="text-violet-100">{exam.examName}</span>
          <span className="text-slate-400"> — </span>
          <span className="tabular-nums text-violet-200">
            {exam.daysRemaining} gün kaldı
          </span>
        </p>
      </div>
    </div>
  );
}
