import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
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
  return {
    user: {
      id: current.user.id,
      email: current.user.email ?? null,
    },
    role: current.profile.role,
    status: current.profile.status,
  };
}

/** Sunucu oturumunu okuyup vitrin navbar'ını render eder. */
export async function NavbarServer(): Promise<ReactNode> {
  const auth = await loadNavbarAuth();
  return <Navbar auth={auth} />;
}
