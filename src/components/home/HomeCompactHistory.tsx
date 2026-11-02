'use client';

import { type ReactNode } from 'react';
import { ChevronRight, History, Loader2 } from 'lucide-react';
import {
  ENGINE_LABELS,
  formatAttemptDate,
  type AttemptRecord,
} from '@/lib/exam-shared';

interface HomeCompactHistoryProps {
  attempts: AttemptRecord[];
  loading: boolean;
  onOpen: (attempt: AttemptRecord) => void;
  maxItems?: number;
}

/** Oturumlu kullanıcı için kompakt deneme özeti; misafire gösterilmez. */
export function HomeCompactHistory({
  attempts,
  loading,
  onOpen,
  maxItems = 3,
}: HomeCompactHistoryProps): ReactNode {
  const visible = attempts.slice(0, maxItems);

  if (loading) {
    return (
      <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Son denemeler yükleniyor…
      </div>
    );
  }

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
        <History className="size-4 text-indigo-400" />
        Son denemelerin
      </h2>
      <ul className="space-y-2">
        {visible.map((attempt) => (
          <li key={attempt.id}>
            <button
              type="button"
              onClick={() => onOpen(attempt)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-indigo-400/35 hover:bg-white/[0.06]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-500/20 text-[10px] font-bold text-indigo-100">
                {attempt.curriculum}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">
                  {attempt.examTitle ?? attempt.subject}
                </span>
                <span className="text-xs text-slate-500">
                  {ENGINE_LABELS[attempt.engineType]} ·{' '}
                  {formatAttemptDate(attempt.createdAt)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-slate-500" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
