import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { GuestDiagnosticSolveClient } from '@/app/test-et/[slug]/GuestDiagnosticSolveClient';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { loadGuestDiagnosticExam } from '@/lib/test-et/load-guest-diagnostic-exam';
import {
  curriculumForTestEtSlug,
  isTestEtSlug,
  TEST_ET_SLUGS,
} from '@/lib/test-et/test-et-config';

export const instant = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): { slug: string }[] {
  return TEST_ET_SLUGS.map((slug) => ({ slug }));
}

export default async function TestEtSolvePage({
  params,
}: PageProps): Promise<ReactNode> {
  await connection();

  const { slug } = await params;
  if (!isTestEtSlug(slug)) {
    notFound();
  }

  const curriculum = curriculumForTestEtSlug(slug);
  const exam = await loadGuestDiagnosticExam({ slug, curriculum });

  if (!exam) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/35 text-slate-100">
      <NavbarServer />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <GuestDiagnosticSolveClient exam={exam} slug={slug} />
      </main>
    </div>
  );
}
