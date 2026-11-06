'use client';

import { Activity, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { StudentAnalyticsView } from '@/components/student/StudentAnalyticsView';
import type { StudentAnalyticsData } from '@/lib/student-analytics';
import {
  buildCaieKpiStats,
  buildIeltsKpiStats,
  buildMilestoneSnapshot,
  buildSatKpiStats,
} from '@/lib/student-dashboard/performance-overview';

interface StudentPerformanceOverviewSectionProps {
  analytics: StudentAnalyticsData;
}

function KpiCard({
  emoji,
  title,
  bestLine,
  avgLine,
  countLine,
  empty,
}: {
  emoji: string;
  title: string;
  bestLine: string;
  avgLine: string;
  countLine: string;
  empty: boolean;
}): ReactNode {
  return (
    <div
      className={`rounded-xl border p-4 ${
        empty
          ? 'border-dashed border-white/15 bg-slate-950/30'
          : 'border-white/10 bg-slate-950/50'
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {emoji} {title}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-100">{bestLine}</p>
      <p className="mt-1 text-xs text-slate-400">{avgLine}</p>
      <p className="mt-2 text-[11px] text-slate-500">{countLine}</p>
    </div>
  );
}

export function StudentPerformanceOverviewSection({
  analytics,
}: StudentPerformanceOverviewSectionProps): ReactNode {
  const attempts = analytics.attempts;
  const sat = buildSatKpiStats(attempts);
  const ielts = buildIeltsKpiStats(attempts);
  const caie = buildCaieKpiStats(attempts);
  const milestone = buildMilestoneSnapshot(attempts);

  return (
    <section
      aria-labelledby="performance-roentgen-heading"
      className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.08] via-slate-950/50 to-indigo-500/[0.07]"
    >
      <div className="border-b border-white/10 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-200/90">
          Performans röntgeni
        </p>
        <h2
          id="performance-roentgen-heading"
          className="mt-1 text-base font-semibold text-slate-50 sm:text-lg"
        >
          Başarı ve Gelişim Analitiği (Performans Röntgeni)
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-400">
          Deneme geçmişinden özet KPI&apos;lar; ayrıntılı trend ve zayıf
          kazanımlar aşağıdadır.
        </p>
      </div>

      <div className="space-y-6 p-6">
        {attempts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
            <TrendingUp className="mx-auto size-9 text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-300">
              Henüz Sınav Çözülmedi
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              İlk teşhis veya atanan sınavını tamamladığında burada baseline
              skorun, en son sonucun ve müfredat bazlı özetlerin görünür.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-indigo-400/25 bg-slate-950/50 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-200/90">
                <Activity className="size-3.5" />
                Seviye yolculuğu (milestone)
              </div>
              {milestone ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      0. Gün — baseline
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">
                      {milestone.baselineLabel}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {milestone.curriculumLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      En son skor
                    </p>
                    <p className="mt-1 text-sm font-semibold text-cyan-100">
                      {milestone.latestLabel}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Delta
                    </p>
                    <p className="mt-1 text-sm font-semibold text-emerald-200">
                      {milestone.deltaLabel ?? '—'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Amiral müfredat KPI&apos;ları
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <KpiCard
                  emoji="🏛️"
                  title="Digital SAT"
                  bestLine={
                    sat.count > 0 ? `En yüksek: ${sat.bestDisplay}` : '— /1600'
                  }
                  avgLine={
                    sat.count > 0
                      ? `Ortalama skor: ${sat.avgDisplay} (ham SAT puanı)`
                      : 'Ortalama: —'
                  }
                  countLine={
                    sat.count > 0
                      ? `Çözülen sınav: ${sat.count}`
                      : 'Çözülen sınav: 0'
                  }
                  empty={sat.count === 0}
                />
                <KpiCard
                  emoji="🌍"
                  title="IELTS Academic"
                  bestLine={
                    ielts.count > 0
                      ? `En yüksek: ${ielts.bestDisplay}`
                      : '— /9.0'
                  }
                  avgLine={
                    ielts.count > 0
                      ? `Ortalama band: ${ielts.avgDisplay}`
                      : 'Ortalama: —'
                  }
                  countLine={
                    ielts.count > 0
                      ? `Çözülen görev: ${ielts.count}`
                      : 'Çözülen görev: 0'
                  }
                  empty={ielts.count === 0}
                />
                <KpiCard
                  emoji="🎓"
                  title="CAIE A-Level"
                  bestLine={
                    caie.count > 0
                      ? `En yüksek: ${caie.bestDisplay}`
                      : 'A*–E (henüz not yok)'
                  }
                  avgLine={
                    caie.count > 0
                      ? `Ortalama gösterge: ${caie.avgDisplay}`
                      : 'Ortalama: —'
                  }
                  countLine={
                    caie.count > 0
                      ? `Çözülen vaka: ${caie.count}`
                      : 'Çözülen vaka: 0'
                  }
                  empty={caie.count === 0}
                />
              </div>
            </div>
          </>
        )}

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Trend · başarı yüzdesi · Weakness Ledger
          </p>
          <StudentAnalyticsView
            analytics={analytics}
            showFilters
            emptyHint="Henüz Sınav Çözülmedi — ilk denemen tamamlandığında trend ve zayıf kazanımlar burada listelenir."
          />
        </div>
      </div>
    </section>
  );
}
