'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  GraduationCap,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react';
import type { ReactNode } from 'react';

const PILLARS = [
  {
    icon: Brain,
    title: 'Bilişsel teşhis',
    body: '15 dakikalık seviye tespiti ile güçlü ve gelişime açık alanlarını ölç.',
  },
  {
    icon: Wand2,
    title: 'AI rubrik puanlama',
    body: 'IELTS bandları, Cambridge AO1/AO2/AO3 ve SAT ölçeği — resmî mantığa yakın geri bildirim.',
  },
  {
    icon: Sparkles,
    title: 'Adaptif soru motoru',
    body: 'Digital SAT, IELTS Academic ve CAIE A-Level için ayrı sınav motorları, tek platform.',
  },
  {
    icon: Target,
    title: 'Kabul eşleştirmesi',
    body: 'Hedef üniversite barajlarıyla skorlarını karşılaştır; eksik konulara teşhis köprüsü.',
  },
] as const;

export function HomeGuestVitrine(): ReactNode {
  return (
    <div className="space-y-12 lg:space-y-16">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 via-slate-950/80 to-fuchsia-500/10 px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 size-64 rounded-full bg-cyan-500/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl text-center lg:max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-medium text-cyan-100">
            <GraduationCap className="size-3.5" />
            EdTech · Uluslararası sınav
          </span>
          <h1 className="mt-6 text-balance text-3xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-4xl lg:text-[2.65rem]">
            Uluslararası Sınav Hazırlığında Bilişsel Değerlendirme & Kabul
            Motoru
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
            Digital SAT, IELTS Academic ve Cambridge CAIE sınavlarına yapay zeka
            rubrik puanlamasıyla hazırlanın; hedef üniversitenizin kabul
            barajlarını keşfedin ve gelişim yol haritanızı oluşturun.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/register"
              className="inline-flex w-full min-w-[200px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:brightness-110 sm:w-auto"
            >
              Ücretsiz Başla
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex w-full min-w-[200px] items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/[0.08] sm:w-auto"
            >
              Giriş Yap
            </Link>
            <Link
              href="/career-compass"
              className="inline-flex w-full min-w-[200px] items-center justify-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-6 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/25 sm:w-auto"
            >
              Kariyer Pusulası — 24 Soru
            </Link>
            <Link
              href="/universities"
              className="inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-sky-300 underline-offset-4 hover:underline sm:w-auto"
            >
              Üniversite rehberi
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PILLARS.map((pillar) => {
          const href =
            pillar.title === 'Bilişsel teşhis' ? '/career-compass' : undefined;
          const inner = (
            <>
              <span className="grid size-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-200">
                <pillar.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-sm font-semibold text-slate-100">
                {pillar.title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {pillar.body}
              </p>
              {href ? (
                <span className="mt-3 inline-flex text-xs font-medium text-violet-300">
                  Hemen test et →
                </span>
              ) : null}
            </>
          );
          return href ? (
            <Link
              key={pillar.title}
              href={href}
              className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-indigo-400/25 hover:bg-white/[0.05]"
            >
              {inner}
            </Link>
          ) : (
            <article
              key={pillar.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-indigo-400/25 hover:bg-white/[0.05]"
            >
              {inner}
            </article>
          );
        })}
      </div>
    </div>
  );
}
