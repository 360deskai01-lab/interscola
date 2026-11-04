import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { InterscolaVitrineClient } from '@/app/interscola/InterscolaVitrineClient';
import { NavbarServer } from '@/components/navigation/NavbarServer';

export const instant = false;

export default async function InterscolaPage(): Promise<ReactNode> {
  await connection();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/35 text-slate-100">
      <NavbarServer />
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <InterscolaVitrineClient />
      </main>
    </div>
  );
}
