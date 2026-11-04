'use client';

import type { ReactNode } from 'react';

import { STAKEHOLDER_SECTIONS } from '@/app/sistem/vitrine-content';
import { FadeInSection } from '@/components/vitrine/FadeInSection';
import { FlowVideoPlaceholder } from '@/components/vitrine/FlowVideoPlaceholder';

function MockupPlaceholder({ label }: { label: string }): ReactNode {
  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-indigo-950/30 to-slate-950/90 shadow-xl backdrop-blur-sm"
      aria-label={label}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300/80">
          Mockup
        </span>
        <p className="text-sm font-medium text-slate-300">{label}</p>
      </div>
    </div>
  );
}

export function SistemVitrineClient(): ReactNode {
  return (
    <div className="space-y-20 pb-20 sm:space-y-24">
      <FadeInSection>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
            Platform mimarisi
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Interscola Sistem
          </h1>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
            Paydaş bazlı çözümler — öğrenciden kuruma, üniversite eşleşmesinden burs
            desteğine kadar modüler yetenekler.
          </p>
        </div>
        <div className="mt-10">
          <FlowVideoPlaceholder
            slotLabel="sistem-hero"
            caption="Sistem tanıtım ve ürün turu videosu"
          />
        </div>
      </FadeInSection>

      {STAKEHOLDER_SECTIONS.map((section, index) => {
        const imageFirst = index % 2 === 0;
        return (
          <FadeInSection key={section.id} delay={index * 0.04}>
            <article className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
              <div className={imageFirst ? 'order-1' : 'order-1 md:order-2'}>
                <MockupPlaceholder label={section.mockupLabel} />
              </div>
              <div className={imageFirst ? 'order-2' : 'order-2 md:order-1'}>
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
                  {section.kicker}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-50">{section.title}</h2>
                <p className="mt-2 text-sm font-medium text-indigo-200/90">{section.subtitle}</p>
                <ul className="mt-5 space-y-2.5">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex gap-2 text-sm leading-relaxed text-slate-300"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-400" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </FadeInSection>
        );
      })}
    </div>
  );
}
