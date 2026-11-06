'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { AlertTriangle, Loader2, MessageCircle, X } from 'lucide-react';
import type { FacultyColleague } from '@/app/teacher/faculty-actions';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';
import { unreadFacultyScopeKey } from '@/lib/message-unread-scopes';

interface FacultyBoardModalProps {
  studentId: string | null;
  studentName: string;
  onClose: () => void;
  onLoadFaculty: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: FacultyColleague[];
  }>;
  unreadByAssignment: Record<string, number>;
  onOpenFacultyMessage: (colleague: FacultyColleague, studentContextId: string) => void;
}

export function FacultyBoardModal({
  studentId,
  studentName,
  onClose,
  onLoadFaculty,
  unreadByAssignment,
  onOpenFacultyMessage,
}: FacultyBoardModalProps): ReactNode {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FacultyColleague[] | null>(null);

  useEffect(() => {
    if (!studentId) {
      setRows(null);
      setError(null);
      return;
    }
    setError(null);
    setRows(null);
    startTransition(async () => {
      const result = await onLoadFaculty(studentId);
      if (!result.success) {
        setError(result.error ?? 'Liste yüklenemedi.');
        setRows([]);
        return;
      }
      setRows(result.data ?? []);
    });
  }, [studentId]);

  if (!studentId) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faculty-board-title"
    >
      <div className="flex max-h-[min(88dvh,560px)] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3
              id="faculty-board-title"
              className="text-base font-semibold text-slate-100"
            >
              Ortak Eğitmenler
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : pending || rows === null ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="size-8 animate-spin text-violet-400" />
              <p className="text-sm">Eğitmenler yükleniyor…</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Bu öğrenciyle şu an listede başka aktif eğitmen yok.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.teacherId}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{row.fullName}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {row.email}
                    </p>
                    {row.expertise ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        {row.expertise}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-600">
                        Uzmanlık alanı tanımlı değil.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenFacultyMessage(row, studentId);
                      onClose();
                    }}
                    className="relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-100 transition hover:bg-violet-500/25"
                  >
                    <MessageCircle className="size-3.5" />
                    <span aria-hidden>💬</span>
                    Mesajlaş
                    <UnreadMessageBadge
                      count={
                        unreadByAssignment[
                          unreadFacultyScopeKey(row.teacherId, studentId)
                        ] ?? 0
                      }
                      className="absolute -top-1.5 -right-1.5"
                    />
                  </button>
                </li>
              ))}
            </ul>
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
