'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { ClipboardList, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';
import type { ConversationMessage } from '@/app/messages/actions';
import type { TeacherAssignmentProgressRow } from '@/app/teacher/library-actions';
import {
  MessageConversationModal,
  type MessageThreadTarget,
} from '@/components/messages/MessageConversationModal';

interface TeacherAssignmentsProgressSectionProps {
  rows: TeacherAssignmentProgressRow[];
  unreadByAssignment: Record<string, number>;
  onLoadConversation: (
    partnerId: string,
    assignmentId?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: ConversationMessage[];
  }>;
  onSendMessage: (
    receiverId: string,
    content: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onMarkMessagesRead: (
    senderId: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

function statusBadge(status: string): ReactNode {
  if (status === 'in_progress') {
    return (
      <span className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-100">
        Devam Ediyor
      </span>
    );
  }

  if (status === 'completed') {
    return (
      <span className="inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-100">
        Tamamlandı
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-slate-500/40 bg-slate-500/20 px-2.5 py-0.5 text-xs font-medium text-slate-300">
      Başlanmadı
    </span>
  );
}

function examResultBadge(
  result: TeacherAssignmentProgressRow['examResult'],
): ReactNode {
  if (!result) {
    return <span className="text-slate-600">—</span>;
  }

  const pct = Math.round(result.percentage);

  return (
    <span className="inline-flex max-w-[220px] flex-wrap items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-100">
      <span aria-hidden>🎯</span>
      <span className="truncate">{result.scaledResult}</span>
      <span className="text-emerald-200/80">(%{pct})</span>
    </span>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function TeacherAssignmentsProgressSection({
  rows,
  unreadByAssignment,
  onLoadConversation,
  onSendMessage,
  onMarkMessagesRead,
}: TeacherAssignmentsProgressSectionProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [messageTarget, setMessageTarget] =
    useState<MessageThreadTarget | null>(null);

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-200">
            Ödev & İlerleme Takibi
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Öğrencilerinin atanan materyallerdeki anlık durumları.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Listeyi Yenile
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ClipboardList className="mx-auto size-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-400">
              Henüz atanmış ödev kaydı yok.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Kütüphane sekmesinden materyal atadığında burada görünür.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3 font-medium">Öğrenci</th>
                  <th className="px-6 py-3 font-medium">Materyal</th>
                  <th className="px-6 py-3 font-medium">Atama Tarihi</th>
                  <th className="px-6 py-3 font-medium">Durum</th>
                  <th className="px-6 py-3 font-medium">Sınav Notu / Sonuç</th>
                  <th className="px-6 py-3 text-right font-medium">İletişim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => (
                  <tr
                    key={row.assignmentId}
                    className="transition hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4 font-medium text-slate-100">
                      {row.studentFullName}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-200">{row.materialTitle}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.curriculum}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {formatDate(row.assignedAt)}
                    </td>
                    <td className="px-6 py-4">{statusBadge(row.status)}</td>
                    <td className="px-6 py-4">{examResultBadge(row.examResult)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setMessageTarget({
                            partnerId: row.studentId,
                            partnerLabel: row.studentFullName,
                            assignmentId: row.assignmentId,
                            contextLabel: row.materialTitle,
                          })
                        }
                        className="relative inline-flex items-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20"
                      >
                        <MessageCircle className="size-3.5" />
                        Mesajlar
                        <UnreadMessageBadge
                          count={unreadByAssignment[row.assignmentId] ?? 0}
                          className="absolute -top-1.5 -right-1.5"
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MessageConversationModal
        target={messageTarget}
        onClose={() => {
          setMessageTarget(null);
          router.refresh();
        }}
        onLoadConversation={onLoadConversation}
        onSendMessage={onSendMessage}
        onMarkRead={onMarkMessagesRead}
      />
    </div>
  );
}
