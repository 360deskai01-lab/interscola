'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getFeaturedUniversitiesForHomeAction } from '@/app/home/featured-universities-action';
import { UniversityCardMediaHeader } from '@/components/universities/UniversityVisualMedia';
import type { University } from '@/lib/universities/types';

interface FeaturedUniversitiesCarouselProps {
  /** SSR ile sunulduysa istemci tarafında tekrar fetch edilmez. */
  initialUniversities?: University[];
}

function formatLocation(university: University): string {
  const city = university.city?.trim();
  if (city) return `${city}, ${university.country}`;
  return university.country;
}

function formatSat(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return '—';
  return String(Math.round(score));
}

function formatIelts(band: number | null): string {
  if (band === null || !Number.isFinite(band)) return '—';
  return band.toFixed(1);
}

function universityDetailHref(university: University): string {
  const slug = university.slug.trim();
  return slug ? `/universities/${slug}` : '/universities';
}

function FeaturedUniversityCard({
  university,
}: {
  university: University;
}): ReactNode {
  return (
    <article className="flex w-[min(100%,320px)] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/80 shadow-sm backdrop-blur-sm sm:w-[300px]">
      <UniversityCardMediaHeader university={university} />
      <div className="flex flex-1 flex-col p-5">
      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-slate-50">
          {university.name}
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">
          {formatLocation(university)}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <dt className="text-slate-500">Min SAT</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-100">
            {formatSat(university.min_sat_score)}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <dt className="text-slate-500">Min IELTS</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-100">
            {formatIelts(university.min_ielts_band)}
          </dd>
        </div>
      </dl>

      <Link
        href={universityDetailHref(university)}
        className="mt-4 inline-flex items-center justify-center rounded-lg border border-sky-400/35 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
      >
        Kabul Şartlarını Gör
      </Link>
      </div>
    </article>
  );
}

export function FeaturedUniversitiesCarousel({
  initialUniversities,
}: FeaturedUniversitiesCarouselProps): ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [universities, setUniversities] = useState<University[]>(
    initialUniversities ?? [],
  );
  const [loading, setLoading] = useState(
    (initialUniversities?.length ?? 0) === 0,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialUniversities && initialUniversities.length > 0) {
      setUniversities(initialUniversities);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getFeaturedUniversitiesForHomeAction()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setError(result.error ?? 'Liste yüklenemedi.');
          setUniversities([]);
          return;
        }
        setError(null);
        setUniversities(result.universities);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialUniversities]);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = direction === 'left' ? -340 : 340;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  return (
    <section
      id="vitrin-universiteler"
      className="mt-16 scroll-mt-24 border-t border-white/10 pt-14"
      aria-labelledby="featured-universities-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-300/90">
            Kabul motoru
          </p>
          <h2
            id="featured-universities-heading"
            className="mt-1 text-xl font-semibold text-slate-50 sm:text-2xl"
          >
            Vitrin üniversiteleri
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Hedef okulların SAT ve IELTS barajlarını keşfedin; skorlarınızı
            portaldan eşleştirin.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollBy('left')}
            className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/25 hover:text-white"
            aria-label="Önceki üniversiteler"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy('right')}
            className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-white/25 hover:text-white"
            aria-label="Sonraki üniversiteler"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Üniversiteler yükleniyor…
        </div>
      ) : null}

      {!loading && error ? (
        <p className="mt-8 text-sm text-amber-200/90">{error}</p>
      ) : null}

      {!loading && !error && universities.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">
          Henüz vitrin üniversitesi tanımlanmadı.{' '}
          <Link href="/universities" className="text-sky-300 hover:underline">
            Tüm rehberi görüntüle
          </Link>
        </p>
      ) : null}

      {!loading && universities.length > 0 ? (
        <div
          ref={scrollRef}
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {universities.map((university) => (
            <FeaturedUniversityCard key={university.id} university={university} />
          ))}
        </div>
      ) : null}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/universities" className="text-sky-300 hover:underline">
          Tüm üniversite rehberi →
        </Link>
      </p>
    </section>
  );
}
