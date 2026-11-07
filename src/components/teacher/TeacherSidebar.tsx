'use client';

import Link from 'next/link';
import { LogOut, GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';
import { signOutAction } from '@/app/auth/sign-out-action';
import type { TeacherDashboardTab } from '@/lib/teacher-dashboard/dashboard-tabs';
import { teacherDashboardHref } from '@/lib/teacher-dashboard/dashboard-tabs';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';

const NAV_ITEMS: {
  id: TeacherDashboardTab;
  label: string;
  emoji: string;
  /** Rozet: tüm okunmamış mesaj sayısı (assignments sekmesinde gösterme). */
  showUnread?: boolean;
}[] = [
  { id: 'overview', label: 'Genel Bakış', emoji: '📊' },
  { id: 'students', label: 'Sınıfım & Öğrenciler', emoji: '👥' },
  { id: 'library', label: 'Materyal & Sınav Kütüphanesi', emoji: '📚' },
  { id: 'assignments', label: 'Ödev & Deneme Takibi', emoji: '📈' },
  {
    id: 'messages',
    label: 'İletişim & Mesajlar',
    emoji: '💬',
    showUnread: true,
  },
];

interface TeacherSidebarProps {
  activeTab: TeacherDashboardTab;
  profileEmail: string;
  displayName: string | null;
  unreadMessageTotal: number;
}

export function TeacherSidebar({
  activeTab,
  profileEmail,
  displayName,
  unreadMessageTotal,
}: TeacherSidebarProps): ReactNode {
  const headline = displayName?.trim() || profileEmail;

  return (
    <aside className="lg:sticky lg:top-24 lg:w-72 lg:shrink-0">
      <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur-sm">
        <nav
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="Öğretmen paneli"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const href = teacherDashboardHref(item.id);
            return (
              <Link
                key={item.id}
                href={href}
                scroll={false}
                className={`relative flex min-w-[200px] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition lg:min-w-0 lg:w-full ${
                  isActive
                    ? 'border-indigo-400/45 bg-gradient-to-r from-indigo-500/20 to-violet-500/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-transparent bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-100'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                {item.showUnread && unreadMessageTotal > 0 ? (
                  <UnreadMessageBadge
                    compact
                    count={unreadMessageTotal}
                    className="static shrink-0"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          <Link
            href="/teacher/profile"
            className="flex min-w-[200px] items-center gap-2.5 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2.5 text-left text-sm font-medium text-amber-100 transition hover:border-amber-400/50 hover:bg-amber-500/15 lg:min-w-0 lg:w-full"
          >
            <span className="text-base leading-none" aria-hidden>
              🎓
            </span>
            <span className="leading-snug">Eğitmen Profilim</span>
          </Link>
        </div>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 text-slate-950 shadow-md">
              <GraduationCap className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">
                {headline}
              </p>
              {displayName ? (
                <p className="truncate text-xs text-slate-500">{profileEmail}</p>
              ) : null}
            </div>
          </div>
          <form action={signOutAction} className="mt-2">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:border-rose-400/35 hover:bg-rose-500/10 hover:text-rose-100"
            >
              <LogOut className="size-4 shrink-0" />
              Güvenli çıkış
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
