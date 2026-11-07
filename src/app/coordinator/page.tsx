import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getCoordinatorOrganizationContextAction } from '@/lib/b2b/coordinator-actions';
import {
  COORDINATOR_ELIGIBLE_ORG_ROLES,
  isCoordinatorEligibleOrgRole,
} from '@/lib/b2b/coordinator-types';
import { getCurrentProfile } from '@/lib/auth';
import { getStudentProfileDbClient } from '@/lib/student-profile/load-context';
import { CoordinatorDashboardShell } from '@/components/coordinator/CoordinatorDashboardShell';
import { NavbarServer } from '@/components/navigation/NavbarServer';

export const instant = false;

/**
 * B2B kurum koordinatörü portalı — dinamik oturum + kurum verisi (prerender yok).
 */
export default async function CoordinatorPage(): Promise<ReactNode> {
  await connection();

  const current = await getCurrentProfile();
  if (!current) {
    redirect('/auth/login');
  }

  if (current.profile.status !== 'approved') {
    redirect('/');
  }

  const client = await getStudentProfileDbClient();
  if (!client) {
    console.error('[coordinator-page] Veritabanı istemcisi yok.');
    redirect('/');
  }

  const { data: membershipRows, error: memberError } = await client
    .from('organization_members')
    .select('org_role')
    .eq('user_id', current.user.id)
    .eq('is_active', true);

  if (memberError) {
    console.error('[coordinator-page] Üyelik okunamadı:', memberError.message);
    redirect('/');
  }

  const hasCoordinatorRole = (membershipRows ?? []).some((row) =>
    isCoordinatorEligibleOrgRole(
      (row as { org_role?: string | null }).org_role,
    ),
  );

  if (!hasCoordinatorRole) {
    console.warn(
      '[coordinator-page] Yetkisiz erişim:',
      current.user.email,
      'beklenen org_role:',
      COORDINATOR_ELIGIBLE_ORG_ROLES.join('|'),
    );
    redirect('/');
  }

  const result = await getCoordinatorOrganizationContextAction();
  if (!result.success || !result.data) {
    console.warn(
      '[coordinator-page] Bağlam yüklenemedi:',
      result.error ?? 'bilinmiyor',
    );
    redirect('/');
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <NavbarServer />
      <CoordinatorDashboardShell
        coordinatorName={
          current.profile.full_name?.trim() ||
          current.user.email ||
          'Koordinatör'
        }
        profileEmail={current.user.email ?? ''}
        context={result.data}
      />
    </div>
  );
}
