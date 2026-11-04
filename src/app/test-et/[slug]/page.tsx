import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { TestEtVitrineClient } from '@/app/test-et/[slug]/TestEtVitrineClient';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { Footer } from '@/components/navigation/Footer';
import { getCurrentProfile } from '@/lib/auth';
import { loadPublicDiagnosticPreview } from '@/lib/test-et/load-public-diagnostic';
import {
  TEST_ET_VITRINE,
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isTestEtSlug(slug)) {
    return { title: 'Test Et | Interscola' };
  }
  const content = TEST_ET_VITRINE[slug];
  return {
    title: `${content.headline} | Interscola`,
    description: content.methodology.slice(0, 160),
  };
}

export default async function TestEtSlugPage({
  params,
}: PageProps): Promise<ReactNode> {
  await connection();

  const { slug } = await params;
  if (!isTestEtSlug(slug)) {
    notFound();
  }

  const content = TEST_ET_VITRINE[slug];
  const curriculum = curriculumForTestEtSlug(slug);
  const diagnostic = await loadPublicDiagnosticPreview(curriculum);

  const current = await getCurrentProfile();
  const isApprovedStudent =
    current?.profile.role === 'student' &&
    current.profile.status === 'approved';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/35 text-slate-100">
      <NavbarServer />
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <TestEtVitrineClient
          content={content}
          curriculum={curriculum}
          diagnostic={diagnostic}
          isApprovedStudent={isApprovedStudent}
        />
      </main>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <Footer />
      </div>
    </div>
  );
}
