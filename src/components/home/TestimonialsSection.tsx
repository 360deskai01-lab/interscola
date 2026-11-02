'use client';

import { Quote } from 'lucide-react';
import type { ReactNode } from 'react';

const TESTIMONIALS = [
  {
    role: 'Öğrenci · Digital SAT',
    headline: '1180 → 1460 · Bocconi kabulü',
    body: 'AI rubrikleri hangi kazanımlarda zayıf kaldığımı net gösterdi; haftalık tekrar planım skor artışını hızlandırdı.',
    accent: 'from-cyan-500/15 to-indigo-500/10',
  },
  {
    role: 'Öğretmen · Zümre başkanı',
    headline: 'Toplu atama + AO analizi',
    body: 'Cambridge A-Level denemelerinde AO1, AO2 ve AO3 dağılımını sınıf bazında tek ekranda izliyoruz; ödev atama akışı pratik.',
    accent: 'from-violet-500/15 to-fuchsia-500/10',
  },
  {
    role: 'Veli',
    headline: 'Baraj şeffaflığı',
    body: 'Hedef üniversitenin SAT ve IELTS eşiğine kalan puanı çocuğumun gelişim raporunda açıkça görüyorum; sürpriz kalmadı.',
    accent: 'from-emerald-500/15 to-teal-500/10',
  },
] as const;

export function TestimonialsSection(): ReactNode {
  return (
    <section
      id="sosyal-kanit"
      className="mt-16 scroll-mt-24 border-t border-white/10 pt-14"
      aria-labelledby="testimonials-heading"
    >
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Deneyimler
        </p>
        <h2
          id="testimonials-heading"
          className="mt-2 text-xl font-semibold text-slate-50 sm:text-2xl"
        >
          Kullanıcı deneyimleri
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
          Öğrenci, eğitmen ve veli perspektifinden Interscola akışı.
        </p>
      </div>

      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {TESTIMONIALS.map((item) => (
          <li key={item.role}>
            <article
              className={`flex h-full flex-col rounded-xl border border-white/10 bg-gradient-to-br ${item.accent} p-6`}
            >
              <Quote
                className="size-8 text-white/20"
                aria-hidden
              />
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                {item.role}
              </p>
              <h3 className="mt-2 text-base font-semibold text-slate-50">
                {item.headline}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-300">
                {item.body}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
