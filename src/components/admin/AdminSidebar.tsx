'use client';

import Link from 'next/link';
import { GraduationCap, LogOut, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { signOutAdmin } from '@/app/admin/actions';
import {
  adminDashboardHref,
  type AdminDashboardTab,
} from '@/lib/admin/dashboard-tabs';

const NAV_ITEMS: {
  id: Exclude<AdminDashboardTab, 'all'>;
  label: string;
  emoji: string;
  /** Bekleyen kayıt sayısı rozeti (yalnızca pending). */
  showPendingBadge?: boolean;
  /** Bekleyen uyarı rozeti (yalnızca intelligence). */
  showIntelBadge?: boolean;
}[] = [
  {
    id: 'pending',
    label: 'Onay Bekleyenler',
    emoji: '⏳',
    showPendingBadge: true,
  },
  { id: 'approved', label: 'Onaylanan Kullanıcılar', emoji: '👥' },
  { id: 'rejected', label: 'Reddedilenler', emoji: '🚫' },
  { id: 'b2b', label: 'Kurumsal Lisanslar (B2B)', emoji: '🏛️' },
  {
    id: 'universities',
    label: 'Üniversite & Müfredat Yönetimi',
    emoji: '🎓',
  },
  {
    id: 'intelligence',
    label: 'Otonom İstihbarat',
    emoji: '📡',
    showIntelBadge: true,
  },
  { id: 'audit', label: 'Denetim & Sınav Günlüğü', emoji: '📋' },
];

export interface AdminSidebarProps {
  activeTab: AdminDashboardTab;
  profileEmail: string;
  displayName: string | null;
  pendingCount: number;
  intelligencePendingCount: number;
}

export function AdminSidebar({
  activeTab,
  profileEmail,
  displayName,
  pendingCount,
  intelligencePendingCount,
}: AdminSidebarProps): ReactNode {
  const headline = displayName?.trim() || profileEmail;

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-72">
      <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur-sm lg:min-h-[calc(100dvh-3rem)]">
        <div className="mb-4 flex items-center gap-3 px-1">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-lg shadow-indigo-900/40">
            <GraduationCap className="size-6 text-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-100">
              Interscola
            </p>
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
              <ShieldCheck className="size-3" />
              Yönetim
            </span>
          </div>
        </div>

        <nav
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="Yönetici paneli"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const href = adminDashboardHref(item.id);
            const navBadge = item.showPendingBadge
              ? pendingCount
              : item.showIntelBadge
                ? intelligencePendingCount
                : 0;

            return (
              <Link
                key={item.id}
                href={href}
                scroll={false}
                className={`relative flex min-w-[220px] shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition lg:min-w-0 lg:w-full ${
                  isActive
                    ? 'border-indigo-400/45 bg-gradient-to-r from-indigo-500/20 to-violet-500/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'border-transparent bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-100'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                {navBadge > 0 ? (
                  <span
                    className={`flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums shadow-md ${
                      item.showIntelBadge
                        ? 'bg-rose-500/90 text-white shadow-rose-900/40'
                        : 'size-6 bg-amber-500/90 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.45)]'
                    }`}
                    aria-label={
                      item.showIntelBadge
                        ? `${navBadge} bekleyen uyarı`
                        : `${navBadge} onay bekleyen`
                    }
                  >
                    {navBadge > 99 ? '99+' : navBadge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-indigo-200/90 uppercase tracking-wide">
                Master Admin
              </p>
              <p className="truncate text-sm font-medium text-slate-100">
                {headline}
              </p>
              {displayName ? (
                <p className="truncate text-xs text-slate-500">{profileEmail}</p>
              ) : null}
            </div>
          </div>
          <form action={signOutAdmin} className="mt-2">
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
