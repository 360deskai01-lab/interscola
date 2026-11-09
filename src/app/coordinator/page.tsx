import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import {
  getCoordinatorDashboardDataAction,
  requireApprovedCoordinator,
} from '@/app/coordinator/coordinator-actions';
import { CoordinatorDashboardShell } from '@/components/coordinator/CoordinatorDashboardShell';
import { NavbarServer } from '@/components/navigation/NavbarServer';

export const instant = false;

/**
 * B2B kurum koordinatörü portalı — dinamik oturum + kurum verisi (prerender yok).
 */
export default async function CoordinatorPage(): Promise<ReactNode> {
  await connection();

  const coordinator = await requireApprovedCoordinator();
  if (!coordinator) {
    redirect('/auth/login');
  }

  const dashboardResult = await getCoordinatorDashboardDataAction();
  if (!dashboardResult.success || !dashboardResult.data) {
    console.warn(
      '[coordinator-page] Masası yüklenemedi:',
      dashboardResult.error ?? 'bilinmiyor',
    );
    redirect('/');
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <NavbarServer />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CoordinatorDashboardShell
          coordinatorName={coordinator.fullName}
          profileEmail={coordinator.email ?? ''}
          dashboard={dashboardResult.data}
        />
      </div>
    </div>
  );
}
