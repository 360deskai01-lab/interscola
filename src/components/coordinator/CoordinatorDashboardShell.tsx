'use client';

import { Suspense, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseCoordinatorDashboardTab } from '@/lib/coordinator-dashboard/dashboard-tabs';
import type { CoordinatorOrganizationContext } from '@/lib/b2b/coordinator-types';
import { CoordinatorDashboardClient } from '@/components/coordinator/CoordinatorDashboardClient';

export interface CoordinatorDashboardShellProps {
  coordinatorName: string;
  profileEmail: string;
  context: CoordinatorOrganizationContext;
}

function CoordinatorDashboardShellInner(
  props: CoordinatorDashboardShellProps,
): ReactNode {
  const searchParams = useSearchParams();
  const activeTab = parseCoordinatorDashboardTab(searchParams.get('tab'));
  return <CoordinatorDashboardClient {...props} activeTab={activeTab} />;
}

export function CoordinatorDashboardShell(
  props: CoordinatorDashboardShellProps,
): ReactNode {
  return (
    <Suspense
      fallback={
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-400">
          Koordinatör paneli yükleniyor…
        </div>
      }
    >
      <CoordinatorDashboardShellInner {...props} />
    </Suspense>
  );
}
