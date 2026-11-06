'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import type { WeeklyDigestRow } from '@/app/teacher/digest-actions';

interface WeeklyDigestModalProps {
  studentId: string | null;
  studentName: string;
  onClose: () => void;
  onGenerate: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: WeeklyDigestRow;
  }>;
  onPublish: (
    digestId: string,
    body: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function WeeklyDigestModal({
  studentId,
  studentName,
  onClose,
  onGenerate,
  onPublish,
}: WeeklyDigestModalProps): ReactNode {
  const [genPending, startGen] = useTransition();
  const [pubPending, startPub] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draft, setDraft] = useState<WeeklyDigestRow | null>(null);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!studentId) {
      setDraft(null);
      setBody('');
      setError(null);
      setSuccess(null);
      return;
    }
    setError(null);
    setSuccess(null);
    setDraft(null);
    setBody('');
    startGen(async () => {
      const result = await onGenerate(studentId);
      if (!result.success || !result.data) {
        setError(result.error ?? 'Özet oluşturulamadı.');
        return;
      }
      setDraft(result.data);
      setBody(result.data.body);
    });
  }, [studentId]);

  if (!studentId) return null;

  function handlePublish() {
    if (!draft?.id) return;
    const trimmed = body.trim();
    if (!trimmed) {
      setError('Yayınlamadan önce metin boş olamaz.');
      return;
    }
    setError(null);
    setSuccess(null);
    startPub(async () => {
      const result = await onPublish(draft.id, trimmed);
      if (!result.success) {
        setError(result.error ?? 'Yayınlanamadı.');
        return;
      }
      setSuccess('Özet yayınlandı.');
    });
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-digest-title"
    >
      <div className="flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3
              id="weekly-digest-title"
              className="text-base font-semibold text-slate-100"
            >
              Haftalık Değerlendirme Taslağı
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {studentName}
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          {success ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
              <span>{success}</span>
            </div>
          ) : null}

          {genPending && !draft ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="size-8 animate-spin text-cyan-400" />
              <p className="text-sm">Özet hazırlanıyor…</p>
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-slate-500">
                Taslak metni (düzenleyebilirsin)
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm leading-relaxed text-slate-100 outline-none focus:border-cyan-400/45"
                />
              </label>
              {draft ? (
                <p className="text-[11px] text-slate-600">
                  Durum: {draft.status === 'published' ? 'yayında' : 'taslak'} ·
                  Hafta: {draft.weekStart}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Kapat
          </button>
          <button
            type="button"
            disabled={genPending || pubPending || !draft || draft.status === 'published'}
            onClick={() => {
              if (!studentId) return;
              setError(null);
              startGen(async () => {
                const result = await onGenerate(studentId);
                if (!result.success || !result.data) {
                  setError(result.error ?? 'Özet yenilenemedi.');
                  return;
                }
                setDraft(result.data);
                setBody(result.data.body);
              });
            }}
            className="rounded-xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50"
          >
            {genPending ? (
              <Loader2 className="inline size-4 animate-spin" />
            ) : (
              'Yeniden üret'
            )}
          </button>
          <button
            type="button"
            disabled={
              pubPending ||
              !draft ||
              draft.status === 'published' ||
              genPending ||
              !body.trim()
            }
            onClick={handlePublish}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/20 transition hover:brightness-110 disabled:opacity-50"
          >
            {pubPending ? (
              <Loader2 className="inline size-4 animate-spin" />
            ) : (
              'Onayla & Yayınla'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
