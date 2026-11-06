'use client';

import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { TeacherStudent } from '@/app/teacher/actions';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';
import {
  MessageConversationModal,
  type MessageThreadTarget,
} from '@/components/messages/MessageConversationModal';
import type { ConversationMessage } from '@/app/messages/actions';
import { unreadGeneralScopeKey } from '@/lib/message-unread-scopes';

interface TeacherMessagesHubSectionProps {
  students: TeacherStudent[];
  unreadByAssignment: Record<string, number>;
  onLoadConversation: (
    partnerId: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: ConversationMessage[];
  }>;
  onSendMessage: (
    receiverId: string,
    content: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onMarkMessagesRead: (
    senderId: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function TeacherMessagesHubSection({
  students,
  unreadByAssignment,
  onLoadConversation,
  onSendMessage,
  onMarkMessagesRead,
}: TeacherMessagesHubSectionProps): ReactNode {
  const router = useRouter();
  const [target, setTarget] = useState<MessageThreadTarget | null>(null);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-slate-200">
          İletişim & Mesajlar
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Öğrencinle genel mesajlaşma (ödev bağlamı olmadan). Materyale özel
          konuşmalar için{" "}
          <span className="text-slate-400">Ödev & İlerleme Takibi</span>{" "}
          sekmesindeki satırdan mesaj gönderebilirsin.
        </p>
      </div>

      {students.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
          <p className="text-sm text-slate-400">
            Bağlı öğrenci olmadan mesaj gönderemezsin.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Önce Sınıfım & Öğrenciler sekmesinden davet kodu ile öğrenci ekle.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {students.map((student) => {
            const unread =
              unreadByAssignment[unreadGeneralScopeKey(student.studentId)] ??
              0;
            return (
              <li key={student.linkId}>
                <button
                  type="button"
                  onClick={() =>
                    setTarget({
                      partnerId: student.studentId,
                      partnerLabel: student.fullName,
                      contextLabel: 'Genel mesaj',
                    })
                  }
                  className="relative flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-violet-400/35 hover:bg-violet-500/10"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">
                      {student.fullName}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {student.email}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/15 px-2.5 py-1.5 text-[11px] font-medium text-violet-100">
                    <MessageCircle className="size-3.5" />
                    Mesaj
                    <UnreadMessageBadge
                      count={unread}
                      className="static"
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <MessageConversationModal
        target={target}
        onClose={() => {
          setTarget(null);
          router.refresh();
        }}
        onLoadConversation={onLoadConversation}
        onSendMessage={onSendMessage}
        onMarkRead={onMarkMessagesRead}
      />
    </div>
  );
}
