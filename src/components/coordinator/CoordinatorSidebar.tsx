'use client';

import Link from 'next/link';
import { Building2, LogOut, ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { signOutAction } from '@/app/auth/sign-out-action';
import type { CoordinatorOrganizationSummary } from '@/lib/b2b/coordinator-types';
import {
  coordinatorDashboardHref,
  type CoordinatorDashboardTab,
} from '@/lib/coordinator-dashboard/dashboard-tabs';
import {
  isOrganizationLicenseActive,
  ORG_JOIN_QUOTA_FULL_MESSAGE,
} from '@/lib/b2b/license-quota';

const NAV_ITEMS: {
  id: CoordinatorDashboardTab;
  label: string;
  emoji: string;
}[] = [
  { id: 'overview', label: 'Genel Bakış', emoji: '📊' },
  { id: 'codes', label: 'Katılım Kodları & Davet', emoji: '🔑' },
  { id: 'students', label: 'Kayıtlı Öğrenciler', emoji: '👥' },
  { id: 'teachers', label: 'Öğretmen Kadrosu', emoji: '👨‍🏫' },
  { id: 'branches', label: 'Şubeler & Kampüsler', emoji: '🏛️' },
];

function formatValidUntil(iso: string | null): string {
  if (!iso) return 'Süresiz';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export interface CoordinatorSidebarProps {
  activeTab: CoordinatorDashboardTab;
  coordinatorName: string;
  profileEmail: string;
  orgName: string;
  organization: CoordinatorOrganizationSummary;
}

export function CoordinatorSidebar({
  activeTab,
  coordinatorName,
  profileEmail,
  orgName,
  organization,
}: CoordinatorSidebarProps): ReactNode {
  const headline = coordinatorName.trim() || profileEmail;
  const quotaTotal =
    organization.studentQuota != null && organization.studentQuota > 0
      ? organization.studentQuota
      : null;
  const fillPercent =
    quotaTotal != null
      ? Math.min(
          100,
          Math.round((organization.seatsUsed / quotaTotal) * 100),
        )
      : organization.usagePercent != null
        ? Math.min(100, Math.round(organization.usagePercent))
        : null;

  const licenseOk = isOrganizationLicenseActive(
    organization.isActive,
    organization.validUntil,
  );

  return (
    <aside className="lg:sticky lg:top-24 lg:w-72 lg:shrink-0">
      <div className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-slate-950/70 p-4 backdrop-blur-sm lg:min-h-[calc(100dvh-10rem)]">
        <nav
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="Kurum koordinatörü"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const href = coordinatorDashboardHref(item.id);
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
              </Link>
            );
          })}
        </nav>

        {/* Kota kalkanı */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <ShieldAlert className="size-3.5 text-indigo-300" aria-hidden />
            Kota kalkanı
          </p>
          <p className="mt-2 text-lg font-semibold tabular-nums text-slate-100">
            {organization.seatsUsed}
            {quotaTotal != null ? (
              <span className="text-sm font-normal text-slate-400">
                {' '}
                / {quotaTotal} koltuk
              </span>
            ) : (
              <span className="text-xs font-normal text-slate-500">
                {' '}
                (sınırsız)
              </span>
            )}
          </p>
          {fillPercent != null ? (
            <div className="mt-2 h-2 overflow-hidden rounded-md bg-slate-800">
              <div
                className={`h-full rounded-md transition-[width] ${
                  organization.isQuotaFull
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                    : 'bg-gradient-to-r from-indigo-500 to-fuchsia-500'
                }`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          ) : null}
          <p className="mt-1.5 text-[10px] text-slate-500">
            Lisans bitişi: {formatValidUntil(organization.validUntil)}
          </p>
          {!licenseOk ? (
            <p className="mt-2 text-[11px] leading-snug text-amber-200/90">
              Kurum lisansı pasif veya süresi dolmuş olabilir.
            </p>
          ) : null}
          {organization.isQuotaFull ? (
            <p className="mt-2 text-[11px] leading-snug text-rose-200/90">
              {ORG_JOIN_QUOTA_FULL_MESSAGE}
            </p>
          ) : null}
        </div>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="mb-0 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200/80">
              <Building2 className="size-3.5" aria-hidden />
              Kurum
            </p>
            <p className="mt-1 truncate text-sm font-medium text-indigo-50">
              {orgName}
            </p>
          </div>

          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-lg text-slate-950 shadow-md">
              🏛️
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">
                {headline}
              </p>
              <p className="truncate text-xs text-slate-500">{profileEmail}</p>
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
