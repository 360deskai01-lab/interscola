'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { TeacherAssignmentReviewDetail } from '@/lib/b2b/teacher-assignment-review-types';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export interface TeacherAssignmentReviewDrawerProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: TeacherAssignmentReviewDetail | null;
  onClose: () => void;
}

export function TeacherAssignmentReviewDrawer({
  open,
  loading,
  error,
  detail,
  onClose,
}: TeacherAssignmentReviewDrawerProps): ReactNode {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const typeLabel =
    detail?.assignmentType === 'exam' ? 'Deneme sınavı' : 'Çalışma ödevi';

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
        aria-labelledby="teacher-assignment-review-title"
        className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl shadow-indigo-950/50 backdrop-blur-md sm:max-w-lg"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300/90">
              Ödev inceleme
            </p>
            <h2
              id="teacher-assignment-review-title"
              className="mt-1 truncate text-lg font-semibold text-white"
            >
              {detail?.materialTitle ?? 'Görev yükleniyor…'}
            </h2>
            {detail ? (
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {detail.studentFullName} · {detail.curriculum}
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
              Karne detayı yükleniyor…
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
                <span className="rounded-md border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-100">
                  {typeLabel}
                </span>
                {!detail.isCompleted ? (
                  <span className="rounded-md border border-slate-500/40 bg-slate-500/20 px-2.5 py-1 text-xs font-medium text-slate-200">
                    Öğrenci henüz bu görevi tamamlamadı
                  </span>
                ) : (
                  <span className="rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-100">
                    Tamamlandı
                  </span>
                )}
              </div>

              {!detail.isCompleted ? (
                <p className="text-sm leading-relaxed text-slate-400">
                  Durum:{' '}
                  <span className="font-medium text-slate-200">
                    {detail.status === 'in_progress'
                      ? 'Devam ediyor'
                      : 'Başlanmadı'}
                  </span>
                  . Sonuç kartı görev tamamlandığında burada görünür.
                </p>
              ) : (
                <>
                  <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Başarı özeti
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-500">Puan / band</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {detail.scaledResult ??
                            (detail.rawScore !== null && detail.maxScore !== null
                              ? `${detail.rawScore} / ${detail.maxScore}`
                              : '—')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Doğruluk</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-sky-200">
                          {detail.percentage !== null
                            ? `%${detail.percentage}`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Süre</p>
                        <p className="mt-1 text-sm font-medium text-slate-200">
                          {detail.durationLabel ?? '—'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Tamamlanma: {formatDateTime(detail.completedAt)}
                    </p>
                  </section>

                  <section>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Eksik konular / kazanım boşlukları
                    </p>
                    {detail.weaknessTopics.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {detail.weaknessTopics.map((topic) => (
                          <li
                            key={topic}
                            className="rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-50"
                          >
                            {topic}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-500">
                        Bu oturum için kayıtlı eksik konu etiketi yok veya çalışma
                        ödevi sınav sonucu içermiyor.
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
