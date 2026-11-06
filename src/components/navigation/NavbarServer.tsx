import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import { COORDINATOR_ELIGIBLE_ORG_ROLES } from '@/lib/b2b/coordinator-types';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { Navbar } from '@/components/navigation/Navbar';
import {
  EMPTY_NAVBAR_AUTH,
  type NavbarAuthSnapshot,
} from '@/components/navigation/nav-auth.types';

async function loadNavbarAuth(): Promise<NavbarAuthSnapshot> {
  const current = await getCurrentProfile();
  if (!current) {
    return EMPTY_NAVBAR_AUTH;
  }

  let isCoordinatorPortal = false;
  if (current.profile.status === 'approved') {
    const admin = getSupabaseAdmin(PROFILES_SCHEMA);
    if (admin) {
      const { data: orgRows, error: orgErr } = await admin
        .from('organization_members')
        .select('id')
        .eq('user_id', current.user.id)
        .eq('is_active', true)
        .in('org_role', [...COORDINATOR_ELIGIBLE_ORG_ROLES])
        .limit(1);
      if (!orgErr) {
        isCoordinatorPortal = (orgRows?.length ?? 0) > 0;
      }
    }
  }

  return {
    user: {
      id: current.user.id,
      email: current.user.email ?? null,
    },
    role: current.profile.role,
    status: current.profile.status,
    isCoordinatorPortal,
  };
}

/** Sunucu oturumunu okuyup vitrin navbar'ını render eder. */
export async function NavbarServer(): Promise<ReactNode> {
  const auth = await loadNavbarAuth();
  return <Navbar auth={auth} />;
}
