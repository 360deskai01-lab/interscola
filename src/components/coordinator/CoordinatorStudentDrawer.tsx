'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { CoordinatorStudentDetail } from '@/lib/b2b/coordinator-types';

function formatAttemptDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export interface CoordinatorStudentDrawerProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: CoordinatorStudentDetail | null;
  onClose: () => void;
}

export function CoordinatorStudentDrawer({
  open,
  loading,
  error,
  detail,
  onClose,
}: CoordinatorStudentDrawerProps): ReactNode {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="coordinator-student-drawer-title"
        className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl shadow-indigo-950/50 backdrop-blur-md sm:max-w-lg"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300/90">
              Akademik karne
            </p>
            <h2
              id="coordinator-student-drawer-title"
              className="mt-1 truncate text-lg font-semibold text-white"
            >
              {detail?.displayName ?? 'Öğrenci yükleniyor…'}
            </h2>
            {detail?.email ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {detail.email}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="size-5 animate-spin text-indigo-300" />
              Akademik veri yükleniyor…
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            >
              {error}
            </div>
          ) : null}

          {detail && !loading ? (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {detail.targetExamLabels.length > 0 ? (
                  detail.targetExamLabels.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-100"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">
                    Hedef sınav tanımlı değil
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400">
                Şube:{' '}
                <span className="text-slate-200">
                  {detail.branchName?.trim() || 'Merkez / atanmamış'}
                </span>
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    En iyi SAT
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-sky-100">
                    {detail.bestSatScore !== null
                      ? `${detail.bestSatScore} /1600`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    En iyi IELTS
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-100">
                    {detail.bestIeltsBand !== null
                      ? `Band ${detail.bestIeltsBand.toFixed(1)}`
                      : '—'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Deneme dökümü
                </h3>
                {detail.attempts.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-white/15 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500">
                    Henüz tamamlanmış resmi deneme yok.
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {detail.attempts.map((row) => (
                      <li
                        key={row.id}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
                      >
                        <p className="text-sm font-medium text-slate-100">
                          {row.examTitle}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {row.curriculum} · {formatAttemptDate(row.createdAt)}
                        </p>
                        <p className="mt-1 text-sm tabular-nums text-indigo-100">
                          {row.scoreLabel}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
