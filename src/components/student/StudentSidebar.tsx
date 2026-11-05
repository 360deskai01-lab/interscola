'use client';

import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';
import type { StudentDashboardTab } from '@/lib/student-dashboard/dashboard-tabs';

export interface StudentSidebarNavItem {
  id: StudentDashboardTab;
  label: string;
  emoji: string;
  unreadCount?: number;
  disabled?: boolean;
  hint?: string;
}

const NAV_ITEMS: StudentSidebarNavItem[] = [
  { id: 'cockpit', label: 'Genel Bakış', emoji: '📊' },
  { id: 'explore', label: 'Açık Sınav Havuzu', emoji: '📝' },
  { id: 'career', label: 'Kariyer Pusulası', emoji: '🎯' },
  { id: 'transcript', label: 'Akademik Transkript & GPA', emoji: '🎓' },
  { id: 'portfolio', label: 'Aktivite & Portfolyo', emoji: '🏆' },
  { id: 'assignments', label: 'Ödevlerim & Çalışmalar', emoji: '📚' },
  { id: 'messages', label: 'Eğitmen Mesajları', emoji: '💬' },
];

interface StudentSidebarProps {
  activeTab: StudentDashboardTab;
  onNavigate: (tab: StudentDashboardTab) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  unreadMessageTotal: number;
}

export function StudentSidebar({
  activeTab,
  onNavigate,
  searchQuery,
  onSearchQueryChange,
  unreadMessageTotal,
}: StudentSidebarProps): ReactNode {
  const items = NAV_ITEMS.map((item) =>
    item.id === 'messages'
      ? { ...item, unreadCount: unreadMessageTotal }
      : item,
  );

  return (
    <aside className="lg:sticky lg:top-24 lg:w-72 lg:shrink-0">
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Sınav, ders veya üniversite ara…"
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-2.5 pr-3 pl-10 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/15"
          />
        </label>

        <nav
          className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="Öğrenci paneli"
        >
          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) onNavigate(item.id);
                }}
                className={`relative flex min-w-[200px] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition lg:min-w-0 lg:w-full ${
                  item.disabled
                    ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600'
                    : isActive
                      ? 'border-indigo-400/45 bg-gradient-to-r from-indigo-500/20 to-violet-500/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'border-transparent bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-100'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                {item.hint ? (
                  <span className="shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {item.hint}
                  </span>
                ) : null}
                {(item.unreadCount ?? 0) > 0 ? (
                  <UnreadMessageBadge
                    compact
                    count={item.unreadCount ?? 0}
                    className="static shrink-0"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
