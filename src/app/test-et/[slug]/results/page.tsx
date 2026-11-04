import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { GuestDiagnosticTeaserClient } from '@/app/test-et/[slug]/GuestDiagnosticTeaserClient';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { isTestEtSlug, TEST_ET_SLUGS } from '@/lib/test-et/test-et-config';

export const instant = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): { slug: string }[] {
  return TEST_ET_SLUGS.map((slug) => ({ slug }));
}

export default async function TestEtResultsPage({
  params,
}: PageProps): Promise<ReactNode> {
  await connection();

  const { slug } = await params;
  if (!isTestEtSlug(slug)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/35 text-slate-100">
      <NavbarServer />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <GuestDiagnosticTeaserClient slug={slug} />
      </main>
    </div>
  );
}
