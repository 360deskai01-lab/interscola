'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ExternalLink,
  Globe2,
  Loader2,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';
import { DiagnosticExploreLink } from '@/components/universities/DiagnosticExploreLink';
import { UniversityDetailModal } from '@/components/universities/UniversityDetailModal';
import { UniversityCardMatchBlock } from '@/components/universities/UniversityCard';
import { UniversityCardMediaHeader } from '@/components/universities/UniversityVisualMedia';
import type {
  StudentLatestScores,
  University,
  UniversityCountryFilter,
} from '@/app/universities/actions';
import { universityPagePath } from '@/lib/universities/seo-copy';

const COUNTRY_OPTIONS: { id: UniversityCountryFilter; label: string }[] = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'İtalya', label: 'İtalya' },
  { id: 'Hollanda', label: 'Hollanda' },
  { id: 'İngiltere', label: 'İngiltere' },
  { id: 'ABD', label: 'ABD' },
];

const badgeClass =
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight';

function displayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

interface UniversityExplorerProps {
  universities: University[];
  initialCountry: UniversityCountryFilter;
  initialSearch: string;
  studentScores: StudentLatestScores;
  loadError?: string | null;
}

export function UniversityExplorer({
  universities,
  initialCountry,
  initialSearch,
  studentScores,
  loadError,
}: UniversityExplorerProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [country, setCountry] = useState<UniversityCountryFilter>(initialCountry);
  const [search, setSearch] = useState(initialSearch);
  const [selectedUniv, setSelectedUniv] = useState<University | null>(null);

  const resultCount = useMemo(() => universities.length, [universities.length]);

  const applyFilters = useCallback(
    (nextCountry: UniversityCountryFilter, nextSearch: string) => {
      const params = new URLSearchParams();
      if (nextCountry !== 'ALL') {
        params.set('country', nextCountry);
      }
      const trimmed = nextSearch.trim();
      if (trimmed.length > 0) {
        params.set('search', trimmed);
      }
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `/universities?${query}` : '/universities');
      });
    },
    [router],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(country, search);
  }

  function handleCountryChange(next: UniversityCountryFilter) {
    setCountry(next);
    applyFilters(next, search);
  }

  return (
    <div className="space-y-8">
      <UniversityDetailModal
        isOpen={selectedUniv !== null}
        university={selectedUniv}
        studentScores={studentScores}
        onClose={() => setSelectedUniv(null)}
      />
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur sm:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              Üniversite veya şehir ara
            </span>
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 size-4 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Örn. Milano, Amsterdam, Boston…"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-2.5 pr-3 pl-10 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none focus:ring-1 focus:ring-sky-400/30"
              />
            </span>
          </label>

          <div className="lg:w-auto">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              Ülke
            </span>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={pending}
                  onClick={() => handleCountryChange(option.id)}
                  className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-60 ${
                    country === option.id
                      ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Filtrele
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {pending ? 'Güncelleniyor…' : `${resultCount} üniversite listeleniyor`}
        </p>
      </form>

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          {loadError}
        </div>
      ) : null}

      {universities.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
          <Globe2 className="mx-auto size-10 text-slate-700" />
          <p className="mt-3 text-sm text-slate-400">
            Filtrelere uygun üniversite bulunamadı.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Arama metnini kısaltın veya farklı bir ülke seçin.
          </p>
        </div>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {universities.map((university) => (
            <li
              key={university.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 transition hover:border-indigo-400/25 hover:bg-slate-950/60"
            >
              <UniversityCardMediaHeader
                university={university}
                roundedTopClass="rounded-t-2xl"
              />
              <div className="min-w-0 flex-1 p-5">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUniv(university)}
                    className="flex min-w-0 flex-1 rounded-lg text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400/60"
                  >
                    <h2 className="font-semibold text-slate-100">{university.name}</h2>
                  </button>
                  {university.slug ? (
                    <Link
                      href={universityPagePath(university.slug)}
                      title="Tam rehber sayfası (SEO)"
                      aria-label={`${university.name} tam rehber sayfası`}
                      className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:border-sky-400/40 hover:bg-sky-500/10 hover:text-sky-100"
                    >
                      <BookOpen className="size-4" />
                    </Link>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUniv(university)}
                  className="mt-0 w-full rounded-lg text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400/60"
                >
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={`${badgeClass} border-indigo-400/35 bg-indigo-500/12 text-indigo-100`}
                  >
                    {university.country}
                  </span>
                  {university.city ? (
                    <span
                      className={`${badgeClass} border-slate-500/30 text-slate-300`}
                    >
                      <MapPin className="mr-0.5 inline size-3" aria-hidden />
                      {university.city}
                    </span>
                  ) : null}
                </div>

                {university.description ? (
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {university.description}
                  </p>
                ) : null}

                <div className="mt-4">
                  <UniversityCardMatchBlock
                    university={university}
                    studentScores={studentScores}
                  />
                </div>

                <dl className="mt-4 space-y-2 text-xs text-slate-300">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <div>
                      <dt className="text-slate-500">Min SAT</dt>
                      <dd className="font-medium text-slate-100">
                        {university.min_sat_score ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Min IELTS</dt>
                      <dd className="font-medium text-slate-100">
                        {university.min_ielts_band !== null
                          ? university.min_ielts_band.toFixed(1)
                          : '—'}
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-slate-500">Yıllık harç aralığı</dt>
                    <dd className="font-medium text-slate-100">
                      {displayText(university.tuition_fee_range)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Aylık tahmini yaşam</dt>
                    <dd className="font-medium text-slate-100">
                      {displayText(university.monthly_living_cost)}
                    </dd>
                  </div>
                  {university.accommodation_info ? (
                    <div>
                      <dt className="text-slate-500">Konaklama</dt>
                      <dd className="leading-relaxed text-slate-400">
                        {university.accommodation_info}
                      </dd>
                    </div>
                  ) : null}
                  {university.application_deadlines ? (
                    <div>
                      <dt className="text-slate-500">Başvuru notları</dt>
                      <dd className="leading-relaxed text-slate-400">
                        {university.application_deadlines}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                </button>

              <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedUniv(university)}
                  className="inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg border border-indigo-400/35 bg-indigo-500/12 px-3 py-2.5 text-[11px] font-medium text-indigo-100 transition hover:bg-indigo-500/22 sm:w-auto sm:min-w-[9.5rem] sm:flex-1"
                >
                  <Sparkles className="size-3.5 shrink-0" />
                  Detayları İncele
                </button>
                {university.slug ? (
                  <Link
                    href={universityPagePath(university.slug)}
                    className="inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg border border-sky-400/35 bg-sky-500/10 px-3 py-2.5 text-[11px] font-medium text-sky-100 transition hover:bg-sky-500/20 sm:w-auto sm:min-w-[9.5rem] sm:flex-1"
                  >
                    <BookOpen className="size-3.5 shrink-0" />
                    Tam Rehber Sayfası
                  </Link>
                ) : null}
                {university.website_url ? (
                  <a
                    href={university.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[11px] font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/[0.07] sm:w-auto sm:min-w-[9.5rem] sm:flex-1"
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    Resmi Web Sitesi
                  </a>
                ) : (
                  <span className="inline-flex w-full min-h-10 items-center justify-center rounded-lg border border-white/5 px-3 py-2.5 text-[11px] text-slate-600 sm:w-auto sm:min-w-[9.5rem] sm:flex-1">
                    Web sitesi yok
                  </span>
                )}
                <DiagnosticExploreLink className="inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/12 px-3 py-2.5 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/22 sm:w-auto sm:min-w-[9.5rem] sm:flex-[1.2]" />
              </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
