'use client';

import { useRouter } from 'next/navigation';
import {
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Radar,
  ShieldAlert,
} from 'lucide-react';
import {
  checkUniversitySourceChangesAction,
  dismissOrResolveAlertAction,
} from '@/app/admin/intelligence-actions';
import type {
  IntelligenceAlertRow,
  IntelligenceDashboardSummary,
} from '@/lib/intelligence/types';

interface IntelligenceSectionProps {
  data: IntelligenceDashboardSummary | null;
  loadError?: string;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusBadge(status: IntelligenceAlertRow['status']): ReactNode {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-100">
        <ShieldAlert className="size-3" aria-hidden />
        İnceleme Bekliyor
      </span>
    );
  }
  return (
    <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-100">
      İncelendi
    </span>
  );
}

export function IntelligenceSection({
  data,
  loadError,
}: IntelligenceSectionProps): ReactNode {
  const router = useRouter();
  const [scanPending, startScanTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingCount = data?.pendingCount ?? 0;
  const lastCheckedCount = data?.lastCheckedCount ?? 0;
  const alerts = data?.alerts ?? [];

  function handleScanAll() {
    setScanMessage(null);
    setActionError(null);
    startScanTransition(async () => {
      const result = await checkUniversitySourceChangesAction();
      if (!result.success) {
        setActionError(result.message ?? 'Tarama başarısız.');
        return;
      }
      setScanMessage(result.message ?? 'Tarama tamamlandı.');
      router.refresh();
    });
  }

  function handleResolve(alertId: string, action: 'reviewed' | 'dismissed') {
    setActionError(null);
    startActionTransition(async () => {
      const result = await dismissOrResolveAlertAction(alertId, action);
      if (!result.success) {
        setActionError(result.message ?? 'İşlem kaydedilemedi.');
        return;
      }
      router.refresh();
    });
  }

  const busy = scanPending || actionPending;

  return (
    <div className="space-y-5">
      {loadError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {scanMessage ? (
        <div
          role="status"
          className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm text-cyan-100"
        >
          {scanMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Bekleyen değişiklik uyarıları
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-amber-200">
              <ShieldAlert className="size-5" />
              {pendingCount}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Son kontrol edilen okul sayısı
            </p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums text-slate-50">
              <Radar className="size-5 text-indigo-300" />
              {lastCheckedCount}
            </p>
            {data ? (
              <p className="mt-0.5 text-[11px] text-slate-500">
                İzlenen kaynak: {data.monitoredSourceCount}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleScanAll}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-50"
        >
          {scanPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Radar className="size-4" aria-hidden />
          )}
          Şimdi Tüm Kaynakları Tara
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">Üniversite</th>
              <th className="px-4 py-3 font-medium">Değişiklik tarihi</th>
              <th className="px-4 py-3 font-medium">Kaynak sayfa</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 font-medium">Eylem</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  <Radar className="mx-auto size-8 opacity-40" />
                  <p className="mt-2">Bekleyen veya incelenmiş uyarı yok.</p>
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-slate-100">
                    {alert.universityName}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDateTime(alert.detectedAt)}
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <a
                      href={alert.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-sky-300 hover:text-sky-200"
                      title={alert.sourceUrl}
                    >
                      <span className="truncate">{alert.sourceUrl}</span>
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  </td>
                  <td className="px-4 py-3">{statusBadge(alert.status)}</td>
                  <td className="px-4 py-3">
                    {alert.status === 'pending' ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleResolve(alert.id, 'reviewed')}
                          className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          İncelendi Olarak İşaretle
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleResolve(alert.id, 'dismissed')}
                          className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-50"
                        >
                          Yoksay
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
