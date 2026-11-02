import Link from 'next/link';
import { connection } from 'next/server';
import { GraduationCap, Globe2 } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  getStudentLatestScoresAction,
  getTargetUniversitiesAction,
} from '@/app/universities/actions';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { UniversityExplorer } from '@/components/universities/UniversityExplorer';
import {
  isTuitionTier,
  parseExamFilter,
  parseExplorerCountry,
  parsePage,
  parseSortBy,
  type ExplorerCountryFilter,
} from '@/lib/universities/explorer-config';

export const instant = false;

export type ExplorerSearchParams = {
  country?: string;
  search?: string;
  discipline?: string;
  tuitionTier?: string;
  examType?: string;
  sortBy?: string;
  page?: string;
};

type UniversitiesPageProps = {
  searchParams: Promise<ExplorerSearchParams>;
};

/**
 * Yurt dışı üniversite kabul ve yaşam rehberi — ziyaretçi/öğrenci herkese açık okuma.
 */
export default async function UniversitiesPage({
  searchParams,
}: UniversitiesPageProps): Promise<ReactNode> {
  await connection();

  const params = await searchParams;
  const country = parseExplorerCountry(params.country);
  const search = typeof params.search === 'string' ? params.search.trim() : '';
  const discipline =
    typeof params.discipline === 'string' ? params.discipline.trim() : '';
  const tuitionTierRaw =
    typeof params.tuitionTier === 'string' ? params.tuitionTier.trim() : '';
  const tuitionTier = isTuitionTier(tuitionTierRaw) ? tuitionTierRaw : undefined;
  const examType = parseExamFilter(params.examType);
  const sortBy = parseSortBy(params.sortBy);
  const page = parsePage(params.page);

  const [listResult, studentScores] = await Promise.all([
    getTargetUniversitiesAction({
      country: country === 'ALL' ? undefined : country,
      search: search.length > 0 ? search : undefined,
      discipline: discipline.length > 0 ? discipline : undefined,
      tuitionTier,
      examType,
      sortBy,
      page,
    }),
    getStudentLatestScoresAction(),
  ]);

  const universities = listResult.success ? (listResult.universities ?? []) : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/40 text-slate-100">
      <NavbarServer />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-sky-300/90">
              <Globe2 className="size-3.5" />
              Faz 6.1 · Rehber
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Yurt Dışı Üniversite Kabul & Yaşam Rehberi
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Hedef üniversitelerin kabul barajlarını, maliyetlerini ve yaşam
              notlarını karşılaştır. 15 dakikalık teşhis testi ile seviyeni ölçüp
              açık sınav havuzundan pratik yap.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            <GraduationCap className="size-4" />
            Sınav Merkezi
          </Link>
        </header>

        <UniversityExplorer
          universities={universities}
          total={listResult.total ?? universities.length}
          page={listResult.page ?? page}
          pageSize={listResult.pageSize ?? 12}
          totalPages={listResult.totalPages ?? 1}
          initialCountry={country}
          initialSearch={search}
          initialDiscipline={discipline}
          initialTuitionTier={tuitionTier}
          initialExamType={examType}
          initialSortBy={sortBy}
          studentScores={studentScores}
          loadError={listResult.success ? null : listResult.error}
        />
      </div>
    </div>
  );
}
