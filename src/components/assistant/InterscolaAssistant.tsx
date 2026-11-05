'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  CalendarCheck,
  MessageSquareText,
  Minimize2,
  Send,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  GENERIC_FALLBACK_REPLY,
  matchFreeTextQuery,
  QUICK_CHIPS,
  replyForChip,
} from '@/components/assistant/assistant-content';
import {
  ADMIN_AVAILABLE_TIMES,
  buildSlot,
  generateMeetPlaceholder,
  getNextBusinessDays,
} from '@/components/assistant/assistant-scheduling';
import type {
  AssistantPhase,
  BookingContact,
  BookingSlot,
  ChatMessage,
  QuickChipId,
  StoredBooking,
} from '@/components/assistant/types';
import { ASSISTANT_BOOKINGS_STORAGE_KEY } from '@/components/assistant/types';

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function persistBooking(booking: StoredBooking): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(ASSISTANT_BOOKINGS_STORAGE_KEY);
    const list: StoredBooking[] = raw ? (JSON.parse(raw) as StoredBooking[]) : [];
    list.unshift(booking);
    window.localStorage.setItem(
      ASSISTANT_BOOKINGS_STORAGE_KEY,
      JSON.stringify(list.slice(0, 20)),
    );
    console.info('[InterscolaAssistant] Admin bildirimi (simülasyon):', booking);
  } catch {
    console.warn('[InterscolaAssistant] Randevu localStorage yazılamadı');
  }
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Merhaba! Interscola Asistan olarak sınav hazırlığı, paketler ve randevu konularında yardımcı olabilirim. Aşağıdaki hızlı sorulardan birini seçin veya yazın.',
};

const FAB_SPRING = { type: 'spring' as const, stiffness: 260, damping: 20 };
const READY_PILL_AUTO_HIDE_MS = 7000;

export function InterscolaAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [fabEntrance, setFabEntrance] = useState(false);
  const [showReadyPill, setShowReadyPill] = useState(false);
  const [phase, setPhase] = useState<AssistantPhase>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [contact, setContact] = useState<BookingContact>({
    fullName: '',
    email: '',
    phone: '',
  });
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [confirmedBooking, setConfirmedBooking] = useState<StoredBooking | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const [businessDays, setBusinessDays] = useState<Date[]>([]);

  useEffect(() => {
    setBusinessDays(getNextBusinessDays(5, new Date()));
  }, []);

  useEffect(() => {
    const entranceTimer = window.setTimeout(() => {
      setFabEntrance(true);
    }, 1000);
    return () => window.clearTimeout(entranceTimer);
  }, []);

  useEffect(() => {
    if (!fabEntrance) return;
    const pillTimer = window.setTimeout(() => {
      setShowReadyPill(true);
    }, 450);
    return () => window.clearTimeout(pillTimer);
  }, [fabEntrance]);

  useEffect(() => {
    if (!showReadyPill || open) return;
    const hideTimer = window.setTimeout(() => {
      setShowReadyPill(false);
    }, READY_PILL_AUTO_HIDE_MS);
    return () => window.clearTimeout(hideTimer);
  }, [showReadyPill, open]);

  const openAssistant = useCallback(() => {
    setShowReadyPill(false);
    setOpen(true);
    setMinimized(false);
  }, []);

  const toggleAssistant = useCallback(() => {
    setShowReadyPill(false);
    setOpen((value) => {
      const next = !value;
      if (next) setMinimized(false);
      return next;
    });
  }, []);

  const appendMessages = useCallback((items: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...items]);
  }, []);

  useEffect(() => {
    if (!open || minimized) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, open, minimized, phase, confirmedBooking]);

  const handleChip = useCallback(
    (chipId: QuickChipId) => {
      const reply = replyForChip(chipId);
      appendMessages([
        { id: createMessageId(), role: 'user', text: reply.userEcho },
        {
          id: createMessageId(),
          role: 'assistant',
          text: reply.assistantText,
          link: reply.link,
        },
      ]);
      if (reply.startBooking) {
        setPhase('booking_contact');
        setConfirmedBooking(null);
      }
    },
    [appendMessages],
  );

  const handleFreeText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      appendMessages([{ id: createMessageId(), role: 'user', text: trimmed }]);

      const matched = matchFreeTextQuery(trimmed);
      if (matched) {
        appendMessages([
          {
            id: createMessageId(),
            role: 'assistant',
            text: matched.assistantText,
            link: matched.link,
          },
        ]);
        if (matched.startBooking) {
          setPhase('booking_contact');
          setConfirmedBooking(null);
        }
      } else {
        appendMessages([
          {
            id: createMessageId(),
            role: 'assistant',
            text: GENERIC_FALLBACK_REPLY,
            link: { href: '/help', label: 'Yardım merkezi' },
          },
        ]);
      }
      setDraft('');
    },
    [appendMessages],
  );

  function onSubmitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== 'chat' && phase !== 'booking_done') return;
    handleFreeText(draft);
  }

  function onContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contact.fullName.trim() || !contact.email.trim()) return;
    setPhase('booking_slots');
    appendMessages([
      {
        id: createMessageId(),
        role: 'assistant',
        text: 'Teşekkürler! Lütfen aşağıdan uygun gün ve saati seçin.',
      },
    ]);
  }

  function confirmSlot(time: string) {
    const day = businessDays[selectedDayIndex];
    if (!day) return;

    const slot: BookingSlot = buildSlot(day, time as (typeof ADMIN_AVAILABLE_TIMES)[number]);
    const bookingId = createMessageId();
    const meetLink = generateMeetPlaceholder(bookingId);
    const stored: StoredBooking = {
      id: bookingId,
      ...contact,
      ...slot,
      meetLink,
      createdAt: new Date().toISOString(),
    };

    persistBooking(stored);
    setConfirmedBooking(stored);
    setPhase('booking_done');
    appendMessages([
      {
        id: createMessageId(),
        role: 'assistant',
        text: `Randevunuz oluşturuldu: ${slot.dateLabel}, saat ${slot.time}. Google Meet bağlantınız hazır.`,
      },
    ]);
  }

  return (
    <>
      <AnimatePresence>
        {open && !minimized ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-3 z-[60] flex max-h-[min(640px,calc(100dvh-6rem))] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/85 shadow-2xl shadow-indigo-950/50 backdrop-blur-xl sm:right-5"
            role="dialog"
            aria-label="Interscola Asistan"
          >
            <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-indigo-500/20 text-indigo-200">
                  <Bot className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-50">
                    Interscola Asistan
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-emerald-300/90">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    Çevrim içi
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
                  aria-label="Küçült"
                >
                  <Minimize2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setMinimized(false);
                  }}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
                  aria-label="Kapat"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-indigo-500/25 text-indigo-50'
                        : 'border border-white/10 bg-white/[0.04] text-slate-200'
                    }`}
                  >
                    {message.text}
                    {message.link ? (
                      <Link
                        href={message.link.href}
                        className="mt-2 block text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        {message.link.label} →
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}

              {phase === 'chat' ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleChip(chip.id)}
                      className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-left text-[11px] font-medium text-indigo-100 transition hover:bg-indigo-500/20 sm:text-xs"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {phase === 'booking_contact' ? (
                <form
                  onSubmit={onContactSubmit}
                  className="space-y-2 rounded-xl border border-violet-400/25 bg-violet-500/10 p-3"
                >
                  <p className="text-xs font-semibold text-violet-100">
                    İletişim bilgileri
                  </p>
                  <input
                    required
                    placeholder="Ad Soyad"
                    value={contact.fullName}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, fullName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
                  />
                  <input
                    required
                    type="email"
                    placeholder="E-posta"
                    value={contact.email}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, email: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
                  />
                  <input
                    type="tel"
                    placeholder="Telefon"
                    value={contact.phone}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, phone: e.target.value }))
                    }
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/50"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-indigo-500/80 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                  >
                    Devam — takvim
                  </button>
                </form>
              ) : null}

              {phase === 'booking_slots' ? (
                <div className="space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3">
                  <p className="text-xs font-semibold text-cyan-100">Gün seçin</p>
                  <div className="flex flex-wrap gap-2">
                    {businessDays.map((day, index) => (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => setSelectedDayIndex(index)}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] ${
                          selectedDayIndex === index
                            ? 'bg-cyan-500/30 text-cyan-50 ring-1 ring-cyan-400/40'
                            : 'bg-slate-950/50 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {buildSlot(day, '10:00').dateLabel}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-cyan-100">Saat (TR)</p>
                  <div className="flex flex-wrap gap-2">
                    {ADMIN_AVAILABLE_TIMES.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => confirmSlot(time)}
                        className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-400/40 hover:text-cyan-100"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {confirmedBooking ? (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                    <CalendarCheck className="size-4" aria-hidden />
                    Randevunuz oluşturuldu
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-emerald-200/90">
                    <li>{confirmedBooking.dateLabel}</li>
                    <li>Saat: {confirmedBooking.time}</li>
                    <li>
                      Meet:{' '}
                      <span className="font-mono text-[10px]">
                        {confirmedBooking.meetLink}
                      </span>
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>

            <form
              onSubmit={onSubmitDraft}
              className="border-t border-white/10 p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Bize bir soru sorun..."
                  disabled={phase === 'booking_contact' || phase === 'booking_slots'}
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-400/40 disabled:opacity-50"
                  aria-label="Soru yazın"
                />
                <button
                  type="submit"
                  disabled={
                    !draft.trim() ||
                    phase === 'booking_contact' ||
                    phase === 'booking_slots'
                  }
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
                  aria-label="Gönder"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {minimized && open ? (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="fixed bottom-20 right-3 z-[60] rounded-full border border-indigo-400/40 bg-slate-950/90 px-4 py-2 text-xs font-semibold text-indigo-100 shadow-lg backdrop-blur-md sm:right-5"
        >
          Asistan — genişlet
        </button>
      ) : null}

      <div
        className="fixed bottom-4 right-3 z-[60] flex items-center justify-end gap-3 sm:right-5"
        onMouseEnter={() => setShowReadyPill(false)}
      >
        <AnimatePresence>
          {showReadyPill && !open && !minimized ? (
            <motion.button
              type="button"
              initial={{ opacity: 0, x: 12, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={openAssistant}
              className="group relative max-w-[min(240px,calc(100vw-5rem))] rounded-2xl border border-white/15 bg-slate-950/90 px-3.5 py-2.5 text-left shadow-xl shadow-indigo-950/40 backdrop-blur-md"
              aria-label="Asistan hazır — sohbeti aç"
            >
              <span
                className="absolute -right-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 border-r border-b border-white/15 bg-slate-950/90"
                aria-hidden
              />
              <span className="flex items-center gap-2 text-[11px] font-medium text-slate-100 sm:text-xs">
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                👋 Asistan Hazır | Sorular & Randevu
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={toggleAssistant}
          initial={{ scale: 0, y: 30 }}
          animate={
            fabEntrance
              ? { scale: 1, y: 0 }
              : { scale: 0, y: 30 }
          }
          transition={FAB_SPRING}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="relative grid size-[3.75rem] place-items-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-white shadow-[0_8px_32px_rgba(99,102,241,0.45)] ring-2 ring-indigo-200/25"
          aria-expanded={open}
          aria-label={open ? 'Asistanı kapat' : 'Interscola Asistan'}
        >
          <span className="absolute -right-0.5 -top-0.5 flex size-3.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-3.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
          </span>
          <span className="relative grid place-items-center">
            <MessageSquareText className="size-6" aria-hidden />
            <Bot
              className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-violet-700/90 p-0.5 text-indigo-100"
              aria-hidden
            />
          </span>
        </motion.button>
      </div>
    </>
  );
}
