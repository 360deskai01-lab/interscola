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
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Globe2,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { DiagnosticExploreLink } from '@/components/universities/DiagnosticExploreLink';
import { FoundationPathwayBadge } from '@/components/universities/FoundationPathwayBadge';
import { UniversityDetailModal } from '@/components/universities/UniversityDetailModal';
import { getUniversityDisplayBadges } from '@/lib/budget-simulator/university-enrichment';
import { UniversityCardMatchBlock } from '@/components/universities/UniversityCard';
import { UniversityCardMediaHeader } from '@/components/universities/UniversityVisualMedia';
import type {
  StudentLatestScores,
  University,
  UniversityExamFilter,
  UniversitySortBy,
} from '@/app/universities/actions';
import {
  DISCIPLINE_GROUPS,
  EXPLORER_COUNTRY_OPTIONS,
  TUITION_TIER_OPTIONS,
  type ExplorerCountryFilter,
  type TuitionTier,
} from '@/lib/universities/explorer-config';
import { universityPagePath } from '@/lib/universities/seo-copy';
import { tuitionTierShortLabel } from '@/lib/universities/tuition-labels';

const badgeClass =
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight';

function displayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

export interface UniversityExplorerInitialFilters {
  country: ExplorerCountryFilter;
  search: string;
  discipline: string;
  tuitionTier?: TuitionTier;
  examType?: UniversityExamFilter;
  sortBy: UniversitySortBy;
}

interface UniversityExplorerProps {
  universities: University[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  initialCountry: ExplorerCountryFilter;
  initialSearch: string;
  initialDiscipline: string;
  initialTuitionTier?: TuitionTier;
  initialExamType?: UniversityExamFilter;
  initialSortBy: UniversitySortBy;
  studentScores: StudentLatestScores;
  loadError?: string | null;
}

function buildExplorerUrl(
  filters: UniversityExplorerInitialFilters,
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.country !== 'ALL') {
    params.set('country', filters.country);
  }
  const trimmed = filters.search.trim();
  if (trimmed) params.set('search', trimmed);
  if (filters.discipline.trim()) {
    params.set('discipline', filters.discipline.trim());
  }
  if (filters.tuitionTier) {
    params.set('tuitionTier', filters.tuitionTier);
  }
  if (filters.examType) {
    params.set('examType', filters.examType);
  }
  if (filters.sortBy !== 'popular') {
    params.set('sortBy', filters.sortBy);
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `/universities?${query}` : '/universities';
}

export function UniversityExplorer({
  universities,
  total,
  page,
  totalPages,
  initialCountry,
  initialSearch,
  initialDiscipline,
  initialTuitionTier,
  initialExamType,
  initialSortBy,
  studentScores,
  loadError,
}: UniversityExplorerProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [selectedUniv, setSelectedUniv] = useState<University | null>(null);

  const activeFilters: UniversityExplorerInitialFilters = useMemo(
    () => ({
      country: initialCountry,
      search: initialSearch,
      discipline: initialDiscipline,
      tuitionTier: initialTuitionTier,
      examType: initialExamType,
      sortBy: initialSortBy,
    }),
    [
      initialCountry,
      initialSearch,
      initialDiscipline,
      initialTuitionTier,
      initialExamType,
      initialSortBy,
    ],
  );

  /** Sıfırla butonu: arama, ülke ve keşif filtreleri (sıralama hariç). */
  const hasClearableFilters = useMemo(() => {
    return (
      activeFilters.country !== 'ALL' ||
      activeFilters.search.trim().length > 0 ||
      activeFilters.discipline.trim().length > 0 ||
      Boolean(activeFilters.tuitionTier) ||
      Boolean(activeFilters.examType)
    );
  }, [activeFilters]);

  const disciplineActive = activeFilters.discipline.trim().length > 0;
  const tuitionActive = Boolean(activeFilters.tuitionTier);
  const examActive = Boolean(activeFilters.examType);

  const navigate = useCallback(
    (filters: UniversityExplorerInitialFilters, nextPage: number) => {
      startTransition(() => {
        router.push(buildExplorerUrl(filters, nextPage));
      });
    },
    [router],
  );

  function applySearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ ...activeFilters, search }, 1);
  }

  function patchFilters(
    patch: Partial<UniversityExplorerInitialFilters>,
    resetPage = true,
  ) {
    navigate(
      { ...activeFilters, ...patch },
      resetPage ? 1 : page,
    );
  }

  function clearAllFilters() {
    setSearch('');
    startTransition(() => {
      router.push('/universities');
    });
  }

  const countryOptions = EXPLORER_COUNTRY_OPTIONS.map((id) => ({
    id,
    label: id === 'ALL' ? 'Tümü' : id,
  }));

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    const start = Math.max(1, Math.min(page - 2, totalPages - maxButtons + 1));
    const end = Math.min(totalPages, start + maxButtons - 1);
    const nums: number[] = [];
    for (let i = start; i <= end; i += 1) nums.push(i);
    return nums;
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <UniversityDetailModal
        isOpen={selectedUniv !== null}
        university={selectedUniv}
        studentScores={studentScores}
        onClose={() => setSelectedUniv(null)}
      />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-72 xl:w-80">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100">
              <Filter className="size-4 text-indigo-300" aria-hidden />
              Keşif Filtreleri
            </div>

            <form onSubmit={applySearchSubmit} className="mt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">
                  Arama
                </span>
                <span className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-3 size-4 text-slate-500" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Üniversite veya şehir…"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-2.5 pr-3 pl-10 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400/40 focus:outline-none"
                  />
                </span>
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="min-w-0 flex-1 rounded-xl border border-indigo-400/35 bg-indigo-500/15 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-50"
                >
                  Ara
                </button>
                {hasClearableFilters ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={clearAllFilters}
                    title="Tüm filtreleri sıfırla"
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 px-2.5 py-2 text-[11px] font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Sıfırla
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-5">
              <span className="text-xs font-medium text-slate-400">Ülke</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {countryOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      patchFilters({
                        country: option.id as ExplorerCountryFilter,
                      })
                    }
                    className={`rounded-md border px-2 py-1 text-[10px] font-medium transition disabled:opacity-60 ${
                      activeFilters.country === option.id
                        ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <span className="text-xs font-medium text-slate-400">
                Akademik alan
              </span>
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => patchFilters({ discipline: '' })}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition disabled:opacity-60 ${
                    !disciplineActive
                      ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                      : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'
                  }`}
                >
                  Tümü
                </button>
                {DISCIPLINE_GROUPS.map((group) => {
                  const active = activeFilters.discipline === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        patchFilters({
                          discipline: active ? '' : group.id,
                        })
                      }
                      className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition disabled:opacity-60 ${
                        active
                          ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                          : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <span aria-hidden>{group.emoji}</span>
                      <span>{group.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <span className="text-xs font-medium text-slate-400">
                Yıllık eğitim harcı
              </span>
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => patchFilters({ tuitionTier: undefined })}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition disabled:opacity-60 ${
                    !tuitionActive
                      ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-100'
                      : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'
                  }`}
                >
                  Tümü
                </button>
                {TUITION_TIER_OPTIONS.map((tier) => {
                  const active = activeFilters.tuitionTier === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        patchFilters({
                          tuitionTier: active ? undefined : tier.id,
                        })
                      }
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-60 ${
                        active
                          ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-100'
                          : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <span className="block text-[11px] font-medium">
                        {tier.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {tier.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <span className="text-xs font-medium text-slate-400">
                Kabul sınavı
              </span>
              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => patchFilters({ examType: undefined })}
                  className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition disabled:opacity-60 ${
                    !examActive
                      ? 'border-sky-400/40 bg-sky-500/12 text-sky-100'
                      : 'border-white/10 text-slate-300 hover:border-white/20'
                  }`}
                >
                  Tümü
                </button>
                {(
                  [
                    { id: 'SAT' as const, label: 'Digital SAT barajı olanlar' },
                    {
                      id: 'IELTS' as const,
                      label: 'Sadece dil belgesi (IELTS)',
                    },
                    {
                      id: 'ALEVEL' as const,
                      label: 'A-Level / IB kabul edenler',
                    },
                  ] as const
                ).map((exam) => {
                  const active = activeFilters.examType === exam.id;
                  return (
                    <button
                      key={exam.id}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        patchFilters({
                          examType: active ? undefined : exam.id,
                        })
                      }
                      className={`rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition disabled:opacity-60 ${
                        active
                          ? 'border-sky-400/40 bg-sky-500/12 text-sky-100'
                          : 'border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {exam.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {hasClearableFilters ? (
              <button
                type="button"
                disabled={pending}
                onClick={clearAllFilters}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Filtreleri Temizle
              </button>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-100">
                {pending ? (
                  'Güncelleniyor…'
                ) : (
                  <>
                    <span className="tabular-nums text-indigo-200">{total}</span>{' '}
                    üniversite bulundu
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Sayfa {page} / {totalPages}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Sırala
                <select
                  disabled={pending}
                  value={activeFilters.sortBy}
                  onChange={(e) =>
                    patchFilters({
                      sortBy: e.target.value as UniversitySortBy,
                    })
                  }
                  className="rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="popular">Popüler (A–Z)</option>
                  <option value="sat_asc">Min SAT (artan)</option>
                  <option value="tuition_asc">Harç dilimi (artan)</option>
                </select>
              </label>
              {hasClearableFilters ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                >
                  <RotateCcw className="size-3.5" />
                  Filtreleri Temizle
                </button>
              ) : null}
            </div>
          </div>

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
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 text-xs font-medium text-indigo-300 hover:text-indigo-200"
              >
                Tüm filtreleri sıfırla
              </button>
            </div>
          ) : (
            <>
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {universities.map((university) => {
                  const workBadges = getUniversityDisplayBadges(
                    university.slug,
                    university.country,
                    university.special_programs_badge,
                  );
                  return (
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
                          <h2 className="font-semibold text-slate-100">
                            {university.name}
                          </h2>
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
                          <FoundationPathwayBadge
                            university={university}
                            compact
                          />
                          <span
                            className={`${badgeClass} border-indigo-400/35 bg-indigo-500/12 text-indigo-100`}
                          >
                            {university.country}
                          </span>
                          {university.city ? (
                            <span
                              className={`${badgeClass} border-slate-500/30 text-slate-300`}
                            >
                              <MapPin
                                className="mr-0.5 inline size-3"
                                aria-hidden
                              />
                              {university.city}
                            </span>
                          ) : null}
                          {tuitionTierShortLabel(university.tuition_tier) ? (
                            <span
                              className={`${badgeClass} border-emerald-400/30 text-emerald-100`}
                            >
                              {tuitionTierShortLabel(university.tuition_tier)}
                            </span>
                          ) : null}
                          {workBadges.specialProgram ? (
                            <span
                              className={`${badgeClass} border-violet-400/35 bg-violet-500/10 text-violet-100`}
                            >
                              {workBadges.specialProgram}
                            </span>
                          ) : null}
                        </div>
                        {workBadges.partTimeWork ? (
                          <p className="mt-2 inline-flex items-start gap-1 text-[10px] leading-snug text-emerald-200/90">
                            <Briefcase
                              className="mt-0.5 size-3 shrink-0 text-emerald-400"
                              aria-hidden
                            />
                            <span className="line-clamp-2">
                              {workBadges.partTimeWork}
                            </span>
                          </p>
                        ) : null}

                        {university.description ? (
                          <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-400">
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
                        </dl>
                      </button>

                      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedUniv(university)}
                          className="inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg border border-indigo-400/35 bg-indigo-500/12 px-3 py-2.5 text-[11px] font-medium text-indigo-100 transition hover:bg-indigo-500/22 sm:flex-1"
                        >
                          <Sparkles className="size-3.5 shrink-0" />
                          Detayları İncele
                        </button>
                        {university.website_url ? (
                          <a
                            href={university.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[11px] font-medium text-slate-200 transition hover:border-white/25 sm:flex-1"
                          >
                            <ExternalLink className="size-3.5 shrink-0" />
                            Resmi Site
                          </a>
                        ) : null}
                        <DiagnosticExploreLink className="inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/12 px-3 py-2.5 text-[11px] font-medium text-cyan-100 sm:flex-1" />
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>

              {totalPages > 1 ? (
                <nav
                  aria-label="Sayfalama"
                  className="flex flex-wrap items-center justify-center gap-2 pt-2"
                >
                  <button
                    type="button"
                    disabled={pending || page <= 1}
                    onClick={() => navigate(activeFilters, page - 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                    Önceki
                  </button>
                  {pageNumbers.map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={pending}
                      onClick={() => navigate(activeFilters, num)}
                      className={`min-w-9 rounded-lg border px-3 py-2 text-xs font-medium tabular-nums transition disabled:opacity-50 ${
                        num === page
                          ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                          : 'border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={pending || page >= totalPages}
                    onClick={() => navigate(activeFilters, page + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
                  >
                    Sonraki
                    <ChevronRight className="size-4" />
                  </button>
                </nav>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
