'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { PRICING_CARDS } from '@/app/pricing/pricing-content';
import { FadeInSection } from '@/components/vitrine/FadeInSection';

export function PricingVitrineClient(): ReactNode {
  return (
    <div className="space-y-12 pb-16">
      <FadeInSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            6 seviyeli paketler
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Interscola Paketleri
          </h1>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
            Bireysel keşiften kurumsal zincire — rolünüze uygun katmanı seçin.
            Fiyatlandırma canlıya alındığında bu kartlar güncellenecektir.
          </p>
        </div>
      </FadeInSection>

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {PRICING_CARDS.map((card, index) => (
          <li key={card.id} className="h-full">
            <FadeInSection delay={index * 0.04} className="h-full">
            <div
              className={`flex h-full flex-col rounded-2xl border p-6 ${
                card.highlighted
                  ? 'border-indigo-400/40 bg-gradient-to-b from-indigo-500/15 to-slate-950/80 shadow-xl shadow-indigo-950/30'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-50">{card.title}</h2>
                {card.badge ? (
                  <span className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                    {card.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-medium text-indigo-200/80">
                {card.audience}
              </p>
              <p className="mt-3 text-sm font-semibold text-cyan-200/90">
                {card.priceLabel}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {card.description}
              </p>
              <ul className="mt-5 flex-1 space-y-2">
                {card.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex gap-2 text-sm text-slate-300"
                  >
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-emerald-400"
                      aria-hidden
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={card.ctaHref}
                className={`mt-6 inline-flex justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  card.highlighted
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:brightness-110'
                    : 'border border-white/15 bg-white/[0.05] text-slate-200 hover:border-white/30'
                }`}
              >
                {card.ctaLabel}
              </Link>
            </div>
            </FadeInSection>
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-slate-500">
        Paydaş çözümlerini karşılaştırmak için{' '}
        <Link href="/solutions?tab=ogrenci" className="text-indigo-300 hover:text-indigo-200">
          Çözümler hub
        </Link>
        .
      </p>
    </div>
  );
}
