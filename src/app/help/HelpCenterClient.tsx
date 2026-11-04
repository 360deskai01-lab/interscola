'use client';

import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import {
  faqMatchesCategory,
  faqMatchesSearch,
  HELP_CATEGORY_IDS,
  HELP_CATEGORY_LABELS,
  HELP_FAQ_ITEMS,
  normalizeSearchQuery,
  type HelpCategoryId,
} from '@/app/help/help-content';
import { FlowVideoPlaceholder } from '@/components/vitrine/FlowVideoPlaceholder';
import { FadeInSection } from '@/components/vitrine/FadeInSection';
import { NAV_CONTACT_HREF } from '@/components/navigation/nav-config';

export function HelpCenterClient(): ReactNode {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategoryId>('all');
  const [openId, setOpenId] = useState<string | null>(HELP_FAQ_ITEMS[0]?.id ?? null);

  const normalizedQuery = useMemo(() => normalizeSearchQuery(query), [query]);

  const filtered = useMemo(
    () =>
      HELP_FAQ_ITEMS.filter(
        (item) =>
          faqMatchesCategory(item, category) &&
          faqMatchesSearch(item, normalizedQuery),
      ),
    [category, normalizedQuery],
  );

  return (
    <div className="space-y-10 pb-16">
      <FadeInSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
            Yardım merkezi
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            SSS & rehberler
          </h1>
          <p className="mt-4 text-pretty text-sm text-slate-400 sm:text-base">
            Sınavlar, panel kullanımı, kurum lisansı ve paketler hakkında arayın.
          </p>
        </div>

        <div className="relative mx-auto mt-8 max-w-xl">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Örn: teşhis, davet kodu, IELTS…"
            className="w-full rounded-full border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-indigo-400/40 focus:border-indigo-400/40 focus:ring-2"
            aria-label="SSS arama"
          />
        </div>
      </FadeInSection>

      <FadeInSection delay={0.05}>
        <FlowVideoPlaceholder
          slotLabel="help-panel-walkthrough"
          caption="Panel Kullanım Rehberi — Çok Yakında"
        />
      </FadeInSection>

      <div className="flex flex-wrap gap-2">
        {HELP_CATEGORY_IDS.map((id) => {
          const active = category === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              aria-pressed={active}
              className={`rounded-full px-4 py-2 text-xs font-medium sm:text-sm ${
                active
                  ? 'bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/40'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
              }`}
            >
              {HELP_CATEGORY_LABELS[id]}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
            Aramanızla eşleşen soru bulunamadı. Farklı bir anahtar kelime deneyin
            veya{' '}
            <Link href={NAV_CONTACT_HREF} className="text-indigo-300 hover:text-indigo-200">
              iletişime geçin
            </Link>
            .
          </p>
        ) : (
          filtered.map((item) => {
            const open = openId === item.id;
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
                >
                  <span className="text-sm font-semibold text-slate-100 sm:text-base">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
                {open ? (
                  <div className="border-t border-white/10 px-4 pb-4 pt-2 sm:px-5">
                    <p className="text-sm leading-relaxed text-slate-400">
                      {item.answer}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <FadeInSection>
        <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 px-6 py-8 text-center sm:px-10">
          <p className="text-base font-semibold text-slate-100">
            Aradığınızı bulamadınız mı?
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Destek ekibimiz kurumsal lisans, teknik sorunlar ve hesap konularında
            yardımcı olur.
          </p>
          <Link
            href={NAV_CONTACT_HREF}
            className="mt-5 inline-flex rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            İletişime geçin
          </Link>
        </div>
      </FadeInSection>
    </div>
  );
}
