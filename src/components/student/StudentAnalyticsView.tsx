'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import {
  ANALYTICS_CURRICULUM_FILTERS,
  deriveAnalyticsFromAttempts,
  filterAttemptsByCurriculum,
  type AnalyticsCurriculumFilter,
  type StudentAnalyticsData,
} from '@/lib/student-analytics';

interface ChartPoint {
  key: string;
  label: string;
  shortLabel: string;
  percentage: number;
  scaledResult: string;
  examTitle: string;
  curriculum: string;
}

interface StudentAnalyticsViewProps {
  analytics: StudentAnalyticsData;
  showFilters?: boolean;
  emptyHint?: string;
}

function formatChartDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}): ReactNode {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-cyan-400/30 bg-slate-950/95 px-3 py-2 text-xs shadow-lg shadow-cyan-950/40">
      <p className="font-medium text-cyan-100">{point.examTitle}</p>
      <p className="mt-0.5 text-slate-400">{point.label}</p>
      <p className="mt-1 text-slate-200">
        Başarı:{' '}
        <span className="font-semibold text-cyan-200">
          %{Math.round(point.percentage)}
        </span>{' '}
        · {point.scaledResult}
      </p>
    </div>
  );
}

export function StudentAnalyticsView({
  analytics,
  showFilters = true,
  emptyHint,
}: StudentAnalyticsViewProps): ReactNode {
  const [mounted, setMounted] = useState(false);
  const gradientId = useId().replace(/:/g, '');
  const [curriculumFilter, setCurriculumFilter] =
    useState<AnalyticsCurriculumFilter>('ALL');

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredAttempts = useMemo(
    () => filterAttemptsByCurriculum(analytics.attempts, curriculumFilter),
    [analytics.attempts, curriculumFilter],
  );

  const filteredAnalytics = useMemo(
    () => deriveAnalyticsFromAttempts(filteredAttempts),
    [filteredAttempts],
  );

  const chartData = useMemo<ChartPoint[]>(() => {
    return filteredAttempts.map((attempt, index) => {
      const dateLabel = formatChartDate(attempt.createdAt);
      return {
        key: attempt.id,
        label: `${dateLabel} · ${attempt.examTitle}`,
        shortLabel:
          filteredAttempts.length > 6 ? `${index + 1}.` : dateLabel,
        percentage: Math.max(0, Math.min(100, attempt.percentage)),
        scaledResult: attempt.scaledResult,
        examTitle: attempt.examTitle,
        curriculum: attempt.curriculum,
      };
    });
  }, [filteredAttempts]);

  const hasAnyAttempts = analytics.attempts.length > 0;
  const hasFilteredAttempts = filteredAttempts.length > 0;
  const delta = filteredAnalytics.delta;

  if (!hasAnyAttempts) {
    return (
      <div className="px-2 py-10 text-center">
        <TrendingUp className="mx-auto size-9 text-slate-700" />
        <p className="mt-3 text-sm text-slate-400">
          {emptyHint ??
            'İlk sınavınızı çözdükten sonra gelişim grafiğiniz burada belirecektir.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="flex flex-wrap gap-1.5">
          {ANALYTICS_CURRICULUM_FILTERS.map((option) => {
            const active = curriculumFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setCurriculumFilter(option.id)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {!hasFilteredAttempts ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-400">
          Seçilen müfredat için henüz kayıtlı deneme yok.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <p className="mb-3 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              Başarı yüzdesi trendi
            </p>
            <div className="h-[240px] w-full min-w-0">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`studentTrendFill-${gradientId}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="rgb(34, 211, 238)"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="100%"
                          stopColor="rgb(99, 102, 241)"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="rgba(148, 163, 184, 0.12)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `%${value}`}
                      width={42}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="percentage"
                      stroke="rgb(34, 211, 238)"
                      strokeWidth={2}
                        fill={`url(#studentTrendFill-${gradientId})`}
                      dot={false}
                      activeDot={{ r: 5, fill: '#22d3ee' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      stroke="rgb(129, 140, 248)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#818cf8' }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className="h-full animate-pulse rounded-lg bg-white/[0.04]"
                  aria-hidden
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {delta ? (
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-medium tracking-wide text-emerald-200/80 uppercase">
                  Delta gelişim özeti
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  İlk deneme:{' '}
                  <span className="font-semibold text-white">
                    %{Math.round(delta.firstPercentage)}
                  </span>
                  {' → '}
                  Son deneme:{' '}
                  <span className="font-semibold text-white">
                    %{Math.round(delta.lastPercentage)}
                  </span>
                </p>
                <span
                  className={`mt-3 inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                    delta.netChange >= 0
                      ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
                      : 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                  }`}
                >
                  <TrendingUp className="size-3.5" />
                  Net fark: {formatDelta(delta.netChange)} puan
                  <span className="font-normal text-slate-300">
                    · {delta.attemptCount} deneme
                  </span>
                </span>
              </div>
            ) : null}

            <div className="flex-1 rounded-xl border border-violet-400/20 bg-violet-500/10 p-4">
              <p className="text-[11px] font-medium tracking-wide text-violet-200/80 uppercase">
                Geliştirilmesi gereken konular
              </p>
              {filteredAnalytics.learningGaps.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  Tekrarlayan zayıf kazanım tespit edilmedi.
                </p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {filteredAnalytics.learningGaps.map((gap) => (
                    <li
                      key={gap.topic}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-violet-400/35 bg-slate-950/40 px-2 py-1 text-[11px] text-violet-100"
                    >
                      <span className="truncate">{gap.topic}</span>
                      <span className="shrink-0 rounded-sm bg-violet-500/30 px-1 py-0.5 text-[10px] font-semibold">
                        ×{gap.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
