'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, Loader2, Sparkles, Target } from 'lucide-react';
import { useState, useTransition, type ReactNode } from 'react';

import { startTestEtDiagnosticAction } from '@/app/test-et/actions';
import type { PublicDiagnosticPreview } from '@/lib/test-et/load-public-diagnostic';
import {
  testEtHref,
  type TestEtVitrineContent,
} from '@/lib/test-et/test-et-config';
import type { CurriculumCode } from '@/types/exam';
import { FadeInSection } from '@/components/vitrine/FadeInSection';

interface TestEtVitrineClientProps {
  content: TestEtVitrineContent;
  curriculum: CurriculumCode;
  diagnostic: PublicDiagnosticPreview | null;
  isApprovedStudent: boolean;
}

export function TestEtVitrineClient({
  content,
  curriculum,
  diagnostic,
  isApprovedStudent,
}: TestEtVitrineClientProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleStart() {
    if (!diagnostic) {
      setError('Teşhis materyali henüz hazır değil. Lütfen kısa süre sonra tekrar deneyin.');
      return;
    }

    setError(null);

    if (!isApprovedStudent) {
      router.push(`${testEtHref(content.slug)}/solve`);
      return;
    }

    startTransition(async () => {
      const result = await startTestEtDiagnosticAction(curriculum);
      if (result.success && result.assignmentId) {
        router.push(`/exam-session/${result.assignmentId}`);
        return;
      }
      setError(result.error ?? 'Teşhis sınavı başlatılamadı.');
    });
  }

  return (
    <div className="space-y-10 pb-16">
      <FadeInSection>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/35 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200">
            <Sparkles className="size-3.5" aria-hidden />
            {content.badgeLabel}
          </span>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            {content.headline}
          </h1>
          <p className="mt-3 text-pretty text-sm text-slate-400 sm:text-base">
            {content.subtitle}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <Clock className="size-3.5 text-cyan-300" aria-hidden />
              {diagnostic
                ? `${diagnostic.durationMinutes} dk`
                : content.durationLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              <Target className="size-3.5 text-violet-300" aria-hidden />
              {content.scoreScaleLabel}
            </span>
          </div>
        </div>
      </FadeInSection>

      <FadeInSection delay={0.05}>
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Metodoloji
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {content.methodology}
          </p>
          {diagnostic ? (
            <p className="mt-4 text-xs text-slate-500">
              Materyal:{' '}
              <span className="text-slate-400">{diagnostic.title}</span>
              {diagnostic.subject ? ` · ${diagnostic.subject}` : null}
            </p>
          ) : (
            <p className="mt-4 text-xs text-amber-200/90">
              Açık teşhis kaydı bulunamadı — yönetici tohumlaması (
              <code className="text-[10px]">npm run db:seed</code>) gerekebilir.
            </p>
          )}
        </div>
      </FadeInSection>

      <FadeInSection delay={0.08}>
        <div className="mx-auto max-w-2xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Ölçülen beceriler
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {content.measuredSkills.map((skill) => (
              <li
                key={skill}
                className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
              >
                {skill}
              </li>
            ))}
          </ul>
        </div>
      </FadeInSection>

      <FadeInSection delay={0.1}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
          <button
            type="button"
            disabled={pending || !diagnostic}
            onClick={handleStart}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:from-indigo-400 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Ücretsiz Teşhis Testini Başlat
          </button>
          {isApprovedStudent ? (
            <p className="text-xs text-emerald-300/90">
              Oturumunuz hazır — tam motor & panel kaydı için exam-session açılır.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Üyelik gerekmez — hemen çözün, tahmini skorunuzu görün, detay için kayıt olun.
            </p>
          )}
        </div>
      </FadeInSection>

      {error ? (
        <div
          role="alert"
          className="mx-auto flex max-w-lg items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
