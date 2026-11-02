'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, History, Loader2 } from 'lucide-react';
import {
  ENGINE_LABELS,
  formatAttemptDate,
  type AttemptRecord,
} from '@/lib/exam-shared';

interface ExamHistoryProps {
  attempts: AttemptRecord[];
  loading: boolean;
  onOpen: (attempt: AttemptRecord) => void;
}

/**
 * Ana ekrandaki "Son Çözülen Denemelerim" listesi.
 * Veri çekme sorumluluğu `page.tsx`'tedir; bu bileşen yalnızca gösterir.
 */
export function ExamHistory({
  attempts,
  loading,
  onOpen,
}: ExamHistoryProps): ReactNode {
  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <History className="size-4 text-indigo-400" />
          Son Çözülen Denemelerim
        </h2>
        {attempts.length > 0 ? (
          <span className="text-xs text-slate-500">{attempts.length} kayıt</span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Geçmiş yükleniyor…
        </div>
      ) : attempts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            Henüz çözülmüş bir deneme yok.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Bir sınav modu seçip ilk denemeni tamamladığında burada listelenecek.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {attempts.map((attempt, index) => (
            <motion.li
              key={attempt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <button
                type="button"
                onClick={() => onOpen(attempt)}
                className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-left transition hover:border-indigo-400/40 hover:bg-white/[0.06]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/25 text-xs font-semibold text-indigo-100">
                  {attempt.curriculum}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {attempt.examTitle ?? attempt.subject}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {ENGINE_LABELS[attempt.engineType]} ·{' '}
                    {formatAttemptDate(attempt.createdAt)}
                  </span>
                </span>

                <span className="text-right">
                  <span className="block text-sm font-semibold text-white tabular-nums">
                    {attempt.scaledResult}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 tabular-nums">
                    %{attempt.percentage.toFixed(1)}
                  </span>
                </span>

                <ChevronRight className="size-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-300" />
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
