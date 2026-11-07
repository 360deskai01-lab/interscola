'use client';

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { Calendar, Clock, Loader2, X } from 'lucide-react';
import type { LibraryItem } from '@/app/teacher/library-actions';
import type {
  CreateTeacherAssignmentInput,
  TeacherAssignmentStudentOption,
  TeacherBulkAssignmentKind,
} from '@/lib/b2b/teacher-assignment-actions';

export interface TeacherAssignSubmitResult {
  success: boolean;
  error?: string;
  count?: number;
  skippedCount?: number;
  message?: string;
}

export interface TeacherAssignFromLibraryModalProps {
  open: boolean;
  onClose: () => void;
  libraryItems: LibraryItem[];
  studentPool: TeacherAssignmentStudentOption[];
  onSubmit: (
    input: CreateTeacherAssignmentInput,
  ) => Promise<TeacherAssignSubmitResult>;
  onSuccess?: (result: TeacherAssignSubmitResult) => void;
}

function localDatetimeMin(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TeacherAssignFromLibraryModal({
  open,
  onClose,
  libraryItems,
  studentPool,
  onSubmit,
  onSuccess,
}: TeacherAssignFromLibraryModalProps): ReactNode {
  const [pending, startTransition] = useTransition();
  const [libraryId, setLibraryId] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] =
    useState<TeacherBulkAssignmentKind>('official_mock');
  const [dueDate, setDueDate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [resultBanner, setResultBanner] = useState<{
    tone: 'success' | 'warning';
    text: string;
  } | null>(null);

  const minDueLocal = useMemo(() => localDatetimeMin(), [open]);

  const selectedLibrary = useMemo(
    () => libraryItems.find((item) => item.id === libraryId) ?? null,
    [libraryId, libraryItems],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, pending]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResultBanner(null);
    if (libraryItems.length > 0 && !libraryId) {
      setLibraryId(libraryItems[0].id);
    }
  }, [open, libraryItems, libraryId]);

  useEffect(() => {
    if (selectedLibrary) {
      setTitle(selectedLibrary.title);
    }
  }, [selectedLibrary]);

  if (!open) return null;

  function toggleStudent(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(studentPool.map((s) => s.studentId)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function handleSubmit() {
    setError(null);
    setResultBanner(null);
    if (!libraryId) {
      setError('Lütfen kütüphaneden bir sınav seçin.');
      return;
    }
    if (selected.size === 0) {
      setError('En az bir öğrenci seçin.');
      return;
    }
    const dueIso =
      dueDate.trim().length > 0
        ? new Date(dueDate).toISOString()
        : null;

    startTransition(async () => {
      const result = await onSubmit({
        examId: libraryId,
        targetStudentIds: [...selected],
        dueDate: dueIso,
        title: title.trim() || selectedLibrary?.title || 'Ödev',
        kind,
      });
      if (!result.success) {
        setError(result.error ?? 'Atama yapılamadı.');
        return;
      }

      const assigned = result.count ?? 0;
      const skipped = result.skippedCount ?? 0;

      if (skipped > 0) {
        setResultBanner({
          tone: 'warning',
          text: `✅ ${assigned} öğrenciye atandı. ⚠️ ${skipped} öğrenci zaten bu göreve sahip olduğu için atlandı.`,
        });
      } else {
        setResultBanner({
          tone: 'success',
          text: `✅ ${assigned} öğrenciye başarıyla atandı.`,
        });
      }

      onSuccess?.(result);

      window.setTimeout(() => {
        onClose();
        setSelected(new Set());
        setDueDate('');
        setResultBanner(null);
      }, 1600);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-assign-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="teacher-assign-modal-title"
              className="text-lg font-semibold text-white"
            >
              Kütüphaneden yeni ödev ata
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Hazır sınav veya çalışma materyalini öğrencilerine toplu atayın.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
          >
            {error}
          </div>
        ) : null}

        {resultBanner ? (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              resultBanner.tone === 'warning'
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-50'
                : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-50'
            }`}
          >
            {resultBanner.text}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <label className="block text-xs text-slate-400">
            Kütüphane sınavı / materyal
            <select
              value={libraryId}
              onChange={(e) => setLibraryId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-400/45"
            >
              {libraryItems.length === 0 ? (
                <option value="">Kütüphanede materyal yok</option>
              ) : (
                libraryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.curriculum})
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            Atama başlığı
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-400/45"
            />
          </label>

          <fieldset className="text-xs text-slate-400">
            <legend className="mb-2">Atama türü</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setKind('official_mock')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  kind === 'official_mock'
                    ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-50'
                    : 'border-white/10 bg-white/[0.03] text-slate-300'
                }`}
              >
                Deneme sınavı
              </button>
              <button
                type="button"
                onClick={() => setKind('homework')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  kind === 'homework'
                    ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-50'
                    : 'border-white/10 bg-white/[0.03] text-slate-300'
                }`}
              >
                Çalışma ödevi
              </button>
            </div>
          </fieldset>

          <div className="block text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-slate-500" aria-hidden />
              <Clock className="size-3.5 text-slate-500" aria-hidden />
              Son teslim tarihi ve saati (opsiyonel — takvimden seçin)
            </span>
            <div className="relative mt-1.5">
              <Calendar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
              <input
                type="datetime-local"
                value={dueDate}
                min={minDueLocal}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 pl-10 text-sm text-slate-200 outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>
            {dueDate ? (
              <button
                type="button"
                onClick={() => setDueDate('')}
                className="mt-1.5 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                Tarihi temizle
              </button>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">Öğrenciler</p>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-indigo-300 hover:text-indigo-100"
                >
                  Tümünü seç
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-slate-500 hover:text-slate-300"
                >
                  Temizle
                </button>
              </div>
            </div>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/50 p-2">
              {studentPool.length === 0 ? (
                <li className="px-2 py-3 text-center text-sm text-slate-500">
                  Bağlı veya kurum şubesinde öğrenci yok.
                </li>
              ) : (
                studentPool.map((student) => {
                  const checked = selected.has(student.studentId);
                  return (
                    <li key={student.studentId}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.04]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(student.studentId)}
                          className="size-4 rounded border-white/20"
                        />
                        <span className="min-w-0 flex-1 text-sm text-slate-200">
                          {student.fullName}
                        </span>
                        <span
                          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                            student.source === 'individual'
                              ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
                              : 'border-violet-400/30 bg-violet-500/10 text-violet-100'
                          }`}
                        >
                          {student.scopeLabel}
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              pending ||
              libraryItems.length === 0 ||
              studentPool.length === 0
            }
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <span aria-hidden>➕</span>
            )}
            Ata ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
