import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import {
  ArrowLeft,
  Award,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  Home,
  MapPin,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { getStudentLatestScoresAction, type University } from '@/app/universities/actions';
import { fetchTargetUniversityBySlugCached } from '@/lib/universities/cached-university';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { UniversityDetailStickyCta } from '@/components/universities/UniversityDetailStickyCta';
import { UniversityHeroBanner } from '@/components/universities/UniversityVisualMedia';
import { absoluteUrl } from '@/lib/seo/site-url';
import {
  universityPagePath,
  universitySeoDescription,
  universitySeoTitle,
} from '@/lib/universities/seo-copy';
import { listStaticUniversitySlugParams } from '@/lib/universities/sitemap-data';

export const instant = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return listStaticUniversitySlugParams();
}

type UniversityDetailPageProps = {
  params: Promise<{ slug: string }>;
};

function displayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}): ReactNode {
  return (
    <div
      className={`rounded-xl border bg-gradient-to-br px-4 py-3 ${accent}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-50">{value}</p>
    </div>
  );
}

function InfoBlock({
  title,
  icon,
  body,
  accent,
}: {
  title: string;
  icon: ReactNode;
  body: string;
  accent: string;
}): ReactNode {
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${accent}`}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
        {icon}
        {title}
      </h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
        {body}
      </p>
    </div>
  );
}

export async function generateMetadata({
  params,
}: UniversityDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const university = await fetchTargetUniversityBySlugCached(slug);
  if (!university) {
    return {
      title: 'Üniversite Bulunamadı | Interscola',
      robots: { index: false, follow: false },
    };
  }
  const title = universitySeoTitle(university);
  const description = universitySeoDescription(university);
  const canonicalPath = universityPagePath(university.slug);
  const url = absoluteUrl(canonicalPath);

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      locale: 'tr_TR',
      url,
      siteName: 'Interscola',
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

function UniversityMainColumn({ university }: { university: University }): ReactNode {
  const ieltsDisplay =
    university.min_ielts_band !== null
      ? university.min_ielts_band.toFixed(1)
      : '—';
  const satDisplay =
    university.min_sat_score !== null ? String(university.min_sat_score) : '—';

  return (
    <div className="min-w-0 space-y-8">
      <header className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <UniversityHeroBanner university={university} />
        <div className="p-6 pt-14 sm:pt-16">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              {university.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>{university.country}</span>
              {university.city ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {university.city}
                  </span>
                </>
              ) : null}
            </p>
            {university.website_url ? (
              <a
                href={university.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-sky-400/40 hover:text-sky-100"
              >
                <ExternalLink className="size-3.5" />
                Resmi web sitesi
              </a>
            ) : null}
          {university.description ? (
            <p className="mt-5 text-sm leading-relaxed text-slate-300">
              {university.description}
            </p>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="admission-heading">
        <h2
          id="admission-heading"
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-indigo-200"
        >
          <GraduationCap className="size-5" />
          Kabul Barajları (SAT / IELTS / Yerel Sınavlar)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            label="Min SAT Puanı"
            value={satDisplay}
            accent="border-sky-400/25 from-sky-500/10 to-slate-900/40"
          />
          <MetricCard
            label="Min IELTS Band"
            value={ieltsDisplay}
            accent="border-violet-400/25 from-violet-500/10 to-slate-900/40"
          />
        </div>
        {university.local_exam_requirements?.trim() ? (
          <div className="mt-4">
            <InfoBlock
              title="Yerel / Ek Sınav Koşulları"
              icon={<ClipboardList className="size-4 text-indigo-300" />}
              body={university.local_exam_requirements.trim()}
              accent="border-indigo-400/35 from-indigo-500/12 to-slate-950/80"
            />
          </div>
        ) : null}
      </section>

      {university.scholarship_info?.trim() ? (
        <section aria-labelledby="scholarship-heading">
          <h2
            id="scholarship-heading"
            className="mb-4 flex items-center gap-2 text-lg font-semibold text-emerald-200"
          >
            <Award className="size-5" />
            Burs Olanakları (DSU / Merit)
          </h2>
          <InfoBlock
            title="Burs & Finansal Destek"
            icon={<Award className="size-4 text-emerald-300" />}
            body={university.scholarship_info.trim()}
            accent="border-emerald-400/30 from-emerald-500/10 via-indigo-500/10 to-slate-950/80"
          />
        </section>
      ) : null}

      <section aria-labelledby="housing-heading">
        <h2
          id="housing-heading"
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-indigo-200"
        >
          <Home className="size-5" />
          Konaklama Rehberi
        </h2>
        <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">
          {displayText(university.accommodation_info)}
        </p>
      </section>

      <section aria-labelledby="cost-heading">
        <h2
          id="cost-heading"
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-indigo-200"
        >
          <Wallet className="size-5" />
          Yaşam Maliyeti
        </h2>
        <dl className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Yıllık harç aralığı</dt>
            <dd className="mt-0.5 font-medium text-slate-100">
              {displayText(university.tuition_fee_range)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Aylık tahmini yaşam</dt>
            <dd className="mt-0.5 font-medium text-slate-100">
              {displayText(university.monthly_living_cost)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="deadline-heading">
        <h2
          id="deadline-heading"
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-amber-100/90"
        >
          <CalendarClock className="size-5" />
          Başvuru Takvimi
        </h2>
        <p className="whitespace-pre-wrap rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm leading-relaxed text-amber-50/90">
          {displayText(university.application_deadlines)}
        </p>
      </section>
    </div>
  );
}

export default async function UniversityDetailPage({
  params,
}: UniversityDetailPageProps): Promise<ReactNode> {
  await connection();

  const { slug } = await params;

  const [university, studentScores] = await Promise.all([
    fetchTargetUniversityBySlugCached(slug),
    getStudentLatestScoresAction(),
  ]);

  if (!university) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/40 text-slate-100">
      <NavbarServer />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">

        <Link
          href="/universities"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-sky-200"
        >
          <ArrowLeft className="size-4" />
          Tüm Üniversitelere Dön
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <UniversityMainColumn university={university} />
          <UniversityDetailStickyCta
            university={university}
            studentScores={studentScores}
          />
        </div>
      </div>
    </div>
  );
}
