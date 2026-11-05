import { connection } from 'next/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { BudgetSimulatorClient } from '@/app/test-et/budget/BudgetSimulatorClient';
import { loadBudgetCatalogEntries } from '@/lib/budget-simulator/load-catalog';
import { Footer } from '@/components/navigation/Footer';
import { NavbarServer } from '@/components/navigation/NavbarServer';

export const instant = false;

export const metadata: Metadata = {
  title: 'Bütçe & Yaşam Maliyeti Simülatörü | Interscola',
  description:
    'Aylık bütçenize göre Avrupa üniversite ve şehir eşleşmelerini ücretsiz hesaplayın. Misafir teşhis — detaylı liste hesap ile açılır.',
};

export default async function BudgetSimulatorPage(): Promise<ReactNode> {
  await connection();
  const catalog = await loadBudgetCatalogEntries();

  return (
    <>
      <NavbarServer />
      <main className="min-h-[70vh] px-4 pt-28 sm:px-6 lg:px-8">
        <BudgetSimulatorClient catalog={catalog} />
      </main>
      <Footer />
    </>
  );
}
