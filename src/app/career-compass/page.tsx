import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getSessionUser } from '@/lib/auth';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import CareerCompassClient from '@/app/career-compass/CareerCompassClient';

export const instant = false;

export default async function CareerCompassPage(): Promise<ReactNode> {
  await connection();
  const user = await getSessionUser();

  return (
    <>
      <NavbarServer />
      <CareerCompassClient isLoggedIn={Boolean(user)} />
    </>
  );
}
