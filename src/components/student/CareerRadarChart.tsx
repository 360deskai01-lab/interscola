'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

interface CareerRadarChartProps {
  data: { axis: string; value: number }[];
  className?: string;
}

export function CareerRadarChart({
  data,
  className = 'h-52 w-full',
}: CareerRadarChartProps): ReactNode {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || data.length === 0) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/40 text-xs text-slate-500`}
      >
        Radar profili yükleniyor…
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="rgba(255,255,255,0.12)" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <Radar
            name="Uyum"
            dataKey="value"
            stroke="#818cf8"
            fill="#6366f1"
            fillOpacity={0.35}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
