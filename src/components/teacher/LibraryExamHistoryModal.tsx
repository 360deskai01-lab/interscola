'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { LibraryAssignmentHistoryRow } from '@/app/teacher/library-actions';

interface LibraryExamHistoryModalProps {
  libraryId: string | null;
  libraryTitle: string;
  onClose: () => void;
  onLoadHistory: (libraryId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: LibraryAssignmentHistoryRow[];
  }>;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function LibraryExamHistoryModal({
  libraryId,
  libraryTitle,
  onClose,
  onLoadHistory,
}: LibraryExamHistoryModalProps): ReactNode {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LibraryAssignmentHistoryRow[] | null>(null);

  useEffect(() => {
    if (!libraryId) {
      setRows(null);
      setError(null);
      return;
    }
    setError(null);
    setRows(null);
    startTransition(async () => {
      const result = await onLoadHistory(libraryId);
      if (!result.success) {
        setError(result.error ?? 'Liste yüklenemedi.');
        setRows([]);
        return;
      }
      setRows(result.data ?? []);
    });
  }, [libraryId, onLoadHistory]);

  if (!libraryId) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-exam-history-title"
    >
      <div className="flex max-h-[min(92dvh,720px)] w-full max-w-3xl flex-col rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3
              id="library-exam-history-title"
              className="text-base font-semibold text-slate-100"
            >
              👥 Atama Geçmişi
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {libraryTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
              <span>{error}</span>
            </div>
          ) : pending || rows === null ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="size-8 animate-spin text-violet-400" />
              <p className="text-sm">Atamalar yükleniyor…</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Bu sınav henüz hiçbir öğrenciye atanmadı
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Öğrenci</th>
                    <th className="px-4 py-3 font-medium">Atama</th>
                    <th className="px-4 py-3 font-medium">Son teslim</th>
                    <th className="px-4 py-3 font-medium">Durum</th>
                    <th className="px-4 py-3 font-medium">Not / Skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((row) => (
                    <tr key={row.assignmentId} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {row.studentFullName}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatDate(row.assignedAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {row.dueDate ? formatDate(row.dueDate) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                            row.workflowLabel === 'Tamamlandı'
                              ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                              : row.workflowLabel === 'Gecikti'
                                ? 'border-amber-400/35 bg-amber-500/15 text-amber-100'
                                : 'border-sky-400/35 bg-sky-500/15 text-sky-100'
                          }`}
                        >
                          {row.workflowLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {row.assignmentType === 'exam' && row.examResult ? (
                          <span className="font-medium text-emerald-200">
                            {row.examResult.scaledResult}
                            <span className="ml-1.5 text-emerald-300/70">
                              (%{Math.round(row.examResult.percentage)})
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
