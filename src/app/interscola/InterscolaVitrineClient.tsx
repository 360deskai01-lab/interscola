'use client';

import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';

import { FadeInSection } from '@/components/vitrine/FadeInSection';
import { FlowVideoPlaceholder } from '@/components/vitrine/FlowVideoPlaceholder';
import {
  AI_CAPABILITY_ICONS,
  ECOSYSTEM_CARDS,
  EXAM_ENGINE_CARDS,
  SCIENCE_APPROACH_CARDS,
  VIEW_360_CARDS,
  type VitrineCard,
} from '@/app/interscola/vitrine-content';

function SectionHeading({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: string;
}): ReactNode {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {kicker ? (
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/90">
          {kicker}
        </p>
      ) : null}
      <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function IconCardGrid({
  items,
  columns = 'sm:grid-cols-2 lg:grid-cols-3',
}: {
  items: VitrineCard[];
  columns?: string;
}): ReactNode {
  return (
    <ul className={`grid grid-cols-1 gap-4 ${columns}`}>
      {items.map((item) => (
        <li
          key={item.title}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-indigo-400/25 hover:bg-indigo-500/[0.06]"
        >
          <item.icon className="size-6 text-indigo-300" aria-hidden />
          <h3 className="mt-3 text-base font-semibold text-slate-100">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function InterscolaVitrineClient(): ReactNode {
  return (
    <div className="space-y-20 pb-20 sm:space-y-24 lg:space-y-28">
      <FadeInSection className="w-full">
        <FlowVideoPlaceholder slotLabel="interscola-hero" caption="Interscola kurumsal tanıtım videosu" />
      </FadeInSection>

      <FadeInSection delay={0.05}>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-lg shadow-indigo-900/40">
            <GraduationCap className="size-8 text-white" />
          </span>
          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
              Interscola
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
              Uluslararası üniversite yolculuğunda ölçülebilir yetkinlik, resmî sınav
              standardına yakın değerlendirme ve hedef okul uyumu — tek platformda.
              Öğrenciden kuruma, öğretmenden üniversite rehberine kadar 360° ekosistem.
            </p>
          </div>
          <Link
            href="/auth/register"
            className="inline-flex rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:brightness-110"
          >
            Platforma katıl
          </Link>
        </div>
      </FadeInSection>

      <FadeInSection>
        <SectionHeading
          kicker="Bilimsel yaklaşım"
          title="Ölç, eşleştir, geliştir"
          description="Veri odaklı kararlar; sınav hazırlığından kabul barajına kadar şeffaf izlek."
        />
        <div className="mt-10">
          <IconCardGrid items={SCIENCE_APPROACH_CARDS} columns="sm:grid-cols-2 xl:grid-cols-3" />
        </div>
      </FadeInSection>

      <FadeInSection>
        <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-950/50 via-slate-950 to-indigo-950/60 px-6 py-12 sm:px-10 sm:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-0 size-72 rounded-full bg-cyan-500/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 bottom-0 size-64 rounded-full bg-fuchsia-500/15 blur-3xl"
          />
          <div className="relative">
            <SectionHeading
              kicker="Tam yapay zeka sistemi"
              title="Rubrikten öngörüye"
              description="Yapay zeka destekli puanlama ve analiz katmanı; pedagojik geri bildirimi hızlandırır, öğretmen denetimini korur."
            />
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {AI_CAPABILITY_ICONS.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm"
                >
                  <item.icon className="size-5 text-cyan-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </FadeInSection>

      <FadeInSection>
        <SectionHeading
          kicker="3 uluslararası ana motor"
          title="Resmî sınav ekosistemi"
          description="Her motor kendi rubrik ve format mantığıyla çalışır; tek oturum ve raporlama omurgası."
        />
        <ul className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {EXAM_ENGINE_CARDS.map((engine) => (
            <li
              key={engine.title}
              className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6"
            >
              <span className="inline-flex w-fit rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                {engine.badge}
              </span>
              <engine.icon className="mt-4 size-8 text-indigo-300" />
              <h3 className="mt-3 text-xl font-semibold text-slate-50">{engine.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">
                {engine.description}
              </p>
            </li>
          ))}
        </ul>
      </FadeInSection>

      <FadeInSection>
        <SectionHeading
          kicker="360° bakış"
          title="Yolculuğun her adımı"
          description="Hazırlıktan bursa — tek vitrin, tutarlı veri."
        />
        <div className="mt-10">
          <IconCardGrid items={VIEW_360_CARDS} columns="sm:grid-cols-2 lg:grid-cols-3" />
        </div>
      </FadeInSection>

      <FadeInSection>
        <SectionHeading
          kicker="Ekosistem"
          title="Paydaşlar bir arada"
          description="Kurum, öğretmen, öğrenci ve ebeveyn — rol bazlı paneller, ortak veri sözleşmesi."
        />
        <div className="mt-10">
          <IconCardGrid items={ECOSYSTEM_CARDS} columns="sm:grid-cols-2 lg:grid-cols-4" />
        </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          Sistem mimarisini detaylı görmek için{' '}
          <Link href="/sistem" className="font-medium text-indigo-300 hover:text-indigo-200">
            Sistem sayfasına
          </Link>{' '}
          geçin.
        </p>
      </FadeInSection>
    </div>
  );
}
