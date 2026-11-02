'use client';

import { useTransition, type ReactNode } from 'react';
import { BookOpen, Loader2, MessageCircle, X } from 'lucide-react';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';

export interface StudyMaterialTarget {
  assignmentId: string;
  materialTitle: string;
  studyText: string;
  teacherId: string;
  teacherName: string;
}

interface StudyMaterialReaderModalProps {
  target: StudyMaterialTarget | null;
  unreadFromTeacher?: number;
  onClose: () => void;
  onComplete: (assignmentId: string) => Promise<{ success: boolean; error?: string }>;
  onAskTeacher: (target: StudyMaterialTarget) => void;
}

export function StudyMaterialReaderModal({
  target,
  unreadFromTeacher = 0,
  onClose,
  onComplete,
  onAskTeacher,
}: StudyMaterialReaderModalProps): ReactNode {
  const [pending, startTransition] = useTransition();

  if (!target) return null;

  const activeTarget = target;

  function handleComplete() {
    const assignmentId = activeTarget.assignmentId;
    startTransition(async () => {
      const result = await onComplete(assignmentId);
      if (result.success) {
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/20">
            <BookOpen className="size-5 text-sky-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-100">
              {target.materialTitle}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Çalışma materyali · {target.teacherName}
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
          <article className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-slate-100">
            {target.studyText}
          </article>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            disabled={pending}
            onClick={handleComplete}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 sm:flex-none"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Okudum, Çalışmayı Tamamladım
          </button>
          <button
            type="button"
            onClick={() => onAskTeacher(target)}
            className="relative flex items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-2.5 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/25"
          >
            <MessageCircle className="size-4" />
            Bu Konuda Eğitmene Soru Sor
            <UnreadMessageBadge
              count={unreadFromTeacher}
              className="absolute -top-1.5 -right-1.5"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
