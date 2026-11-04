'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, type ReactNode } from 'react';

import {
  getSolutionTabContent,
  SOLUTION_TABS,
} from '@/app/solutions/solutions-content';
import { FadeInSection } from '@/components/vitrine/FadeInSection';
import {
  parseSolutionTab,
  solutionsTabHref,
  type SolutionTabId,
} from '@/lib/solutions/solution-tabs';

export function SolutionsHubClient(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = useMemo(
    () => parseSolutionTab(searchParams.get('tab')),
    [searchParams],
  );
  const content = useMemo(
    () => getSolutionTabContent(activeTab),
    [activeTab],
  );

  const selectTab = useCallback(
    (tab: SolutionTabId) => {
      router.replace(solutionsTabHref(tab), { scroll: false });
    },
    [router],
  );

  return (
    <div className="space-y-10 pb-16">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {SOLUTION_TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              aria-current={active ? 'true' : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <FadeInSection key={content.id}>
        <div
          className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${content.bannerGradient} px-6 py-12 sm:px-10 sm:py-14`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 top-0 size-56 rounded-full bg-white/5 blur-3xl"
          />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/90">
            Çözümler · {content.label}
          </p>
          <h1 className="mt-3 max-w-3xl text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            {content.title}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-base text-slate-300">
            {content.subtitle}
          </p>
        </div>

        <div className="mt-10 max-w-3xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Metodoloji
          </h2>
          <p className="mt-3 text-pretty text-base leading-relaxed text-slate-300">
            {content.methodology}
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {content.benefits.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <item.icon className="size-6 text-indigo-300" aria-hidden />
              <h3 className="mt-3 font-semibold text-slate-100">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {item.description}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={content.ctaHref}
            className="inline-flex rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:brightness-110"
          >
            {content.ctaLabel}
          </Link>
          <Link
            href="/pricing"
            className="inline-flex rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-white/30"
          >
            Paketleri karşılaştır
          </Link>
        </div>
      </FadeInSection>
    </div>
  );
}
