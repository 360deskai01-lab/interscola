import type { ActivityItem } from '@/lib/student-portfolio/types';

export interface PortfolioKpiSummary {
  totalActivities: number;
  cumulativeAnnualHours: number;
  leadershipCount: number;
}

export function computePortfolioKpis(
  items: ActivityItem[],
): PortfolioKpiSummary {
  let cumulativeAnnualHours = 0;
  let leadershipCount = 0;

  for (const item of items) {
    const hours = item.hoursPerWeek * item.weeksPerYear;
    if (Number.isFinite(hours) && hours > 0) {
      cumulativeAnnualHours += hours;
    }
    if (item.category === 'leadership') {
      leadershipCount += 1;
    }
  }

  return {
    totalActivities: items.length,
    cumulativeAnnualHours: Math.round(cumulativeAnnualHours),
    leadershipCount,
  };
}
