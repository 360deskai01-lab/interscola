'use client';

import type { ReactNode } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { StudentAnalyticsData } from '@/lib/student-analytics';
import { StudentAnalyticsView } from '@/components/student/StudentAnalyticsView';

interface StudentAnalyticsSectionProps {
  analytics: StudentAnalyticsData;
}

export function StudentAnalyticsSection({
  analytics,
}: StudentAnalyticsSectionProps): ReactNode {
  return (
    <div className="overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/[0.07] via-slate-950/40 to-cyan-500/[0.06]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-4">
        <LineChartIcon className="size-4 text-cyan-300" />
        <h2 className="text-sm font-medium text-slate-100">
          Gelişim & Başarı Analitiğim
        </h2>
      </div>

      <div className="p-6">
        <StudentAnalyticsView
          analytics={analytics}
          emptyHint="İlk sınavınızı çözdükten sonra gelişim grafiğiniz burada belirecektir."
        />
        {analytics.attempts.length > 0 ? (
          <p className="mt-4 text-xs text-slate-600">
            Sınav Merkezi ve eğitmeninizin atadığı resmi sınavlar trende dahil
            edilir.
          </p>
        ) : null}
      </div>
    </div>
  );
}
