'use client';

import { ListChecks, Target, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ObserverDashboardViewData } from '@/lib/observer/observer-dashboard-types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${accent} shadow-lg`}
        >
          <Icon className="size-5 text-slate-950" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-0.5 text-lg font-semibold text-white">{value}</p>
          {hint ? (
            <p className="mt-1 text-xs text-slate-400">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ObserverViewClient({
  data,
}: {
  data: ObserverDashboardViewData;
}): ReactNode {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-15%,rgba(99,102,241,0.16),transparent_55%)]"
      />
      <div className="relative mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-8 sm:py-12">
        <header className="border-b border-white/10 pb-6">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-indigo-300/80 uppercase">
            Interscola Akademik Gelişim Raporu
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Veli / Gözlemci Görünümü
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Öğrenci:{' '}
            <span className="font-medium text-slate-200">
              {data.studentDisplayName}
            </span>
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            icon={Target}
            label="Hedef Puan & Güncel Seviye"
            value={data.currentLevelLabel}
            hint={`${data.targetExamLabel} · ${data.targetScoreLabel}`}
            accent="from-indigo-400 to-violet-500"
          />
          <MetricCard
            icon={ListChecks}
            label="Tamamlanan Deneme"
            value={String(data.attemptCount)}
            hint="Platformdaki tüm kayıtlı denemeler"
            accent="from-sky-400 to-cyan-500"
          />
          <MetricCard
            icon={TrendingUp}
            label="Genel Başarı Yüzdesi"
            value={`%${data.overallSuccessPercent}`}
            hint="Tüm denemelerin ortalama doğruluk yüzdesi"
            accent="from-emerald-400 to-teal-500"
          />
        </div>

        {data.timeline.length > 0 ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-medium text-slate-200">
              Sınav gelişim eğrisi (kronoloji)
            </h2>
            <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
              {data.timeline.map((point, index) => (
                <div
                  key={`${point.createdAt}-${index}`}
                  className="flex min-w-[88px] flex-col items-center gap-2"
                >
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-indigo-600/80 to-indigo-400/90"
                    style={{
                      height: `${Math.max(12, Math.min(120, Math.round(point.percentage * 1.2)))}px`,
                    }}
                    title={`%${Math.round(point.percentage)}`}
                  />
                  <span className="text-[10px] text-slate-500">
                    {formatDate(point.createdAt)}
                  </span>
                  <span className="text-[10px] font-medium text-indigo-200">
                    {point.scaledResult}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-medium text-slate-200">
            Sınav deneme geçmişi
          </h2>
          {data.attemptHistory.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Henüz kayıtlı deneme bulunmuyor.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-slate-500">
                    <th className="px-2 py-2 font-medium">Tarih</th>
                    <th className="px-2 py-2 font-medium">Sınav</th>
                    <th className="px-2 py-2 font-medium">Müfredat</th>
                    <th className="px-2 py-2 font-medium">Sonuç</th>
                    <th className="px-2 py-2 font-medium text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attemptHistory.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 text-slate-300 last:border-0"
                    >
                      <td className="px-2 py-2.5 tabular-nums text-slate-400">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-2 py-2.5">{row.examTitle}</td>
                      <td className="px-2 py-2.5">{row.curriculum}</td>
                      <td className="px-2 py-2.5 font-medium text-indigo-100">
                        {row.scaledResult}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        %{Math.round(row.percentage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-5">
          <h2 className="text-sm font-medium text-rose-100">
            🎯 Odaklanılması Gereken Kritik Konular (Weakness Ledger)
          </h2>
          {data.topWeaknessTopics.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              Henüz yeterli deneme verisi yok veya zayıf konu etiketi üretilmedi.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.topWeaknessTopics.map((item) => (
                <li
                  key={item.topic}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm"
                >
                  <span className="text-slate-200">{item.topic}</span>
                  <span className="shrink-0 text-xs text-rose-200/90">
                    {item.occurrenceCount} deneme
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-slate-600">
          Bu sayfa salt-okunur gözlemci modundadır. Veriler anlık olarak
          güncellenir.
        </p>
      </div>
    </div>
  );
}
