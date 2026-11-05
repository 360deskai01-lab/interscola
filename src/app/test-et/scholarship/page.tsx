import { connection } from 'next/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ScholarshipSimulatorClient } from '@/app/test-et/scholarship/ScholarshipSimulatorClient';
import { Footer } from '@/components/navigation/Footer';
import { NavbarServer } from '@/components/navigation/NavbarServer';

export const instant = false;

export const metadata: Metadata = {
  title: 'Burs & Maliyet Uygunluk Simülatörü | Interscola',
  description:
    'Need-based ve merit-based burs ihtimalinizi 8 adımda, üye olmadan hesaplayın. DSU, ER.GO ve Avrupa fon programları için teşhis özeti.',
};

export default async function ScholarshipSimulatorPage(): Promise<ReactNode> {
  await connection();

  return (
    <>
      <NavbarServer />
      <main className="min-h-[70vh] px-4 pt-28 sm:px-6 lg:px-8">
        <ScholarshipSimulatorClient />
      </main>
      <Footer />
    </>
  );
}
