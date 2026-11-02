'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, Loader2, MessageCircle, Send, X } from 'lucide-react';
import type { ConversationMessage } from '@/app/messages/actions';

export interface MessageThreadTarget {
  partnerId: string;
  partnerLabel: string;
  assignmentId?: string;
  contextLabel?: string;
}

interface MessageConversationModalProps {
  target: MessageThreadTarget | null;
  onClose: () => void;
  onLoadConversation: (
    partnerId: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string; data?: ConversationMessage[] }>;
  onSendMessage: (
    receiverId: string,
    content: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onMarkRead: (
    senderId: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function threadKey(target: MessageThreadTarget | null): string | null {
  if (!target) return null;
  return `${target.partnerId}::${target.assignmentId ?? ''}`;
}

export function MessageConversationModal({
  target,
  onClose,
  onLoadConversation,
  onSendMessage,
  onMarkRead,
}: MessageConversationModalProps): ReactNode {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedKeyRef = useRef<string | null>(null);

  const onLoadRef = useRef(onLoadConversation);
  const onSendRef = useRef(onSendMessage);
  const onMarkReadRef = useRef(onMarkRead);
  onLoadRef.current = onLoadConversation;
  onSendRef.current = onSendMessage;
  onMarkReadRef.current = onMarkRead;

  const activeKey = threadKey(target);
  const targetRef = useRef(target);
  targetRef.current = target;

  const loadThread = useCallback(async (thread: MessageThreadTarget) => {
    setLoading(true);
    setLoadError(null);

    const result = await onLoadRef.current(
      thread.partnerId,
      thread.assignmentId,
    );

    setLoading(false);

    if (!result.success) {
      setLoadError(result.error ?? 'Mesajlar yüklenemedi.');
      return;
    }

    setMessages(result.data ?? []);
    void onMarkReadRef.current(thread.partnerId, thread.assignmentId);
  }, []);

  useEffect(() => {
    if (!activeKey) {
      loadedKeyRef.current = null;
      setMessages([]);
      setLoadError(null);
      setSendError(null);
      setDraft('');
      setLoading(false);
      return;
    }

    if (loadedKeyRef.current === activeKey) {
      return;
    }

    const thread = targetRef.current;
    if (!thread) return;

    loadedKeyRef.current = activeKey;
    void loadThread(thread);
  }, [activeKey, loadThread]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;

    const text = draft.trim();
    if (!text) return;

    setSendError(null);

    startTransition(async () => {
      const result = await onSendRef.current(
        target.partnerId,
        text,
        target.assignmentId,
      );

      if (!result.success) {
        setSendError(result.error ?? 'Mesaj gönderilemedi.');
        return;
      }

      setDraft('');
      const reload = await onLoadRef.current(
        target.partnerId,
        target.assignmentId,
      );
      if (reload.success) {
        setMessages(reload.data ?? []);
      }
    });
  }

  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-dialog-title"
    >
      <div className="flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-500/20">
            <MessageCircle className="size-5 text-indigo-300" />
          </span>
          <div className="min-w-0 flex-1">
            <h3
              id="message-dialog-title"
              className="truncate text-base font-semibold text-slate-100"
            >
              {target.partnerLabel}
            </h3>
            {target.contextLabel ? (
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {target.contextLabel}
              </p>
            ) : null}
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

        <div
          ref={scrollRef}
          className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-5 py-4"
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-slate-500" />
            </div>
          ) : null}

          {loadError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          ) : null}

          {!loading && !loadError && messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Henüz mesaj yok. İlk notunu aşağıdan gönderebilirsin.
            </p>
          ) : null}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.isMine
                    ? 'rounded-br-md bg-indigo-600/90 text-white'
                    : 'rounded-bl-md border border-white/10 bg-white/[0.06] text-slate-100'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    msg.isMine ? 'text-indigo-200/80' : 'text-slate-500'
                  }`}
                >
                  {formatMessageTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {sendError ? (
          <div
            role="alert"
            className="mx-5 mb-2 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-2.5 text-xs text-rose-100"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{sendError}</span>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t border-white/10 p-4"
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Sorunu veya geri bildirimini yaz…"
            rows={2}
            maxLength={4000}
            disabled={pending || loading || Boolean(loadError)}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-indigo-400/50 disabled:opacity-50"
            aria-label="Mesaj metni"
          />
          <button
            type="submit"
            disabled={pending || loading || Boolean(loadError) || !draft.trim()}
            className="flex shrink-0 items-center justify-center self-end rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
