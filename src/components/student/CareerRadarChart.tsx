'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import {
  normalizeRadarSeries,
  type RadarPoint,
  radarSeriesHasSignal,
} from '@/lib/assessment/radar-series';

interface CareerRadarChartProps {
  data: RadarPoint[];
  className?: string;
  title?: string;
  emptyHint?: string;
}

export function CareerRadarChart({
  data,
  className = 'h-52 w-full',
  title,
  emptyHint = 'Bu envanter için henüz skor yok.',
}: CareerRadarChartProps): ReactNode {
  const [mounted, setMounted] = useState(false);

  const chartData = useMemo(() => normalizeRadarSeries(data), [data]);
  const hasSignal = radarSeriesHasSignal(chartData);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/40 text-xs text-slate-500`}
      >
        Radar profili yükleniyor…
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 text-center text-xs text-slate-500`}
      >
        {emptyHint}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title ? (
        <h4 className="text-sm font-medium text-slate-200">{title}</h4>
      ) : null}
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.12)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
            />
            <Radar
              name="Profil"
              dataKey="value"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={hasSignal ? 0.4 : 0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
