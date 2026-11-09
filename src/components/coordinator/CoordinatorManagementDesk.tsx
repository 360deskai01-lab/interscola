'use client';

import {
  BarChart3,
  BookOpen,
  Check,
  ClipboardCopy,
  GraduationCap,
  Users,
} from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import type { CoordinatorDashboardData } from '@/app/coordinator/coordinator-dashboard-types';
import { formatJoinCodeDisplay } from '@/lib/b2b/join-code';

export interface CoordinatorManagementDeskProps {
  dashboard: CoordinatorDashboardData;
  coordinatorName: string;
}

function MetricCard({
  label,
  children,
  icon,
}: {
  label: string;
  children: ReactNode;
  icon: ReactNode;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-5 shadow-lg shadow-indigo-950/25 backdrop-blur-sm">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function CoordinatorManagementDesk({
  dashboard,
  coordinatorName,
}: CoordinatorManagementDeskProps): ReactNode {
  const [copied, setCopied] = useState(false);
  const org = dashboard.context.organization;
  const license = dashboard.license;
  const perf = dashboard.context.orgPerformance;

  const joinCodeDisplay = dashboard.joinCode?.trim()
    ? formatJoinCodeDisplay(dashboard.joinCode)
    : '—';

  const copyJoinCode = useCallback(async () => {
    const raw = dashboard.joinCode?.trim();
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(formatJoinCodeDisplay(raw));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [dashboard.joinCode]);

  const quotaLabel =
    license.studentQuota === null
      ? `${license.studentsActive} öğrenci (sınırsız lisans)`
      : `${license.studentsActive} / ${license.studentQuota} lisans`;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-indigo-950/40 backdrop-blur-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300/90">
              Şube yönetim masası
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {org.name}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Koordinatör:{' '}
              <span className="text-slate-200">{coordinatorName}</span>
            </p>
          </div>
        </div>
      </section>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Kurum metrikleri"
      >
        <MetricCard
          label="Aktif öğrenci doluluğu"
          icon={<GraduationCap className="size-4 text-sky-300" aria-hidden />}
        >
          <p className="text-2xl font-semibold tabular-nums text-white">
            {quotaLabel}
          </p>
          {license.usagePercent !== null ? (
            <div className="mt-3 space-y-1.5">
              <div
                className="h-2.5 overflow-hidden rounded-full bg-slate-800"
                role="progressbar"
                aria-valuenow={license.usagePercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 ${
                    license.isQuotaFull ? 'from-amber-500 to-rose-500' : ''
                  }`}
                  style={{ width: `${license.usagePercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {license.isQuotaFull
                  ? 'Kota dolu — yeni öğrenci bağlantısı kapalı.'
                  : license.seatsRemaining !== null
                    ? `${license.seatsRemaining} boş koltuk`
                    : null}
              </p>
            </div>
          ) : null}
        </MetricCard>

        <MetricCard
          label="Eğitmen kadrosu"
          icon={<Users className="size-4 text-indigo-300" aria-hidden />}
        >
          <p className="text-2xl font-semibold text-white">
            {license.teachersActive}{' '}
            <span className="text-base font-normal text-slate-400">
              aktif öğretmen
            </span>
          </p>
          {license.teacherQuota !== null ? (
            <p className="mt-2 text-xs text-slate-500">
              Kota: {license.teachersActive}/{license.teacherQuota}
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Öğretmen lisans kotası tanımlı değil
            </p>
          )}
        </MetricCard>

        <MetricCard
          label="Toplam çözülen deneme"
          icon={<BookOpen className="size-4 text-violet-300" aria-hidden />}
        >
          <p className="text-2xl font-semibold tabular-nums text-white">
            {perf.totalCompletedAttempts}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Kurum öğrencilerinin resmi ve ödev denemeleri (tamamlanmış kayıtlar).
          </p>
        </MetricCard>

        <MetricCard
          label="Kurum ortalaması"
          icon={<BarChart3 className="size-4 text-emerald-300" aria-hidden />}
        >
          <div className="space-y-2 text-sm">
            <p className="text-slate-200">
              Digital SAT:{' '}
              <span className="text-lg font-semibold tabular-nums text-white">
                {perf.avgSatScore !== null ? `${perf.avgSatScore} /1600` : '—'}
              </span>
            </p>
            <p className="text-slate-200">
              IELTS band:{' '}
              <span className="text-lg font-semibold tabular-nums text-emerald-100">
                {perf.avgIeltsBand !== null
                  ? perf.avgIeltsBand.toFixed(1)
                  : '—'}
              </span>
            </p>
          </div>
        </MetricCard>
      </section>

      <section className="rounded-2xl border border-indigo-400/25 bg-indigo-950/25 p-6 backdrop-blur-sm">
        <h2 className="text-base font-semibold text-white">
          Kurum katılım kodu (Join Code)
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Öğrenciler kayıt sonrası bu kodu girerek kuruma bağlanır.
        </p>
        <p className="mt-4 font-mono text-2xl font-semibold tracking-widest text-indigo-50">
          {joinCodeDisplay}
        </p>
        <button
          type="button"
          onClick={() => void copyJoinCode()}
          disabled={!dashboard.joinCode?.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-4 py-2.5 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? (
            <Check className="size-4 text-emerald-300" aria-hidden />
          ) : (
            <ClipboardCopy className="size-4" aria-hidden />
          )}
          {copied ? 'Kopyalandı' : 'Tek tıkla kopyala'}
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/45 p-6">
        <h2 className="text-base font-semibold text-slate-100">
          Öğretmen kadrosu &amp; sınıf yükleri
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Atama tablosundaki benzersiz öğrenci sayılarına göre yük özeti.
        </p>
        <div className="mt-4 w-full overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Ad Soyad</th>
                <th className="px-4 py-3 font-medium">E-posta</th>
                <th className="px-4 py-3 font-medium">Branş / odak</th>
                <th className="px-4 py-3 font-medium">Şube</th>
                <th className="py-3 pl-4 pr-6 text-right font-medium">
                  Bağlı öğrenci
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dashboard.teachersWithLoad.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-slate-500"
                  >
                    Henüz kayıtlı öğretmen yok.
                  </td>
                </tr>
              ) : (
                dashboard.teachersWithLoad.map((row) => (
                  <tr key={row.memberId} className="text-slate-200">
                    <td className="px-4 py-3 font-medium text-white">
                      {row.displayName}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.specialtyLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.branchName ?? '—'}
                    </td>
                    <td className="py-3 pl-4 pr-6 text-right tabular-nums font-medium text-indigo-100">
                      {row.linkedStudentCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
