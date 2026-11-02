'use client';

import Link from 'next/link';
import { Building2, Compass, GraduationCap, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { MajorMatchGroups } from '@/components/career/MajorMatchGroups';
import { CareerRadarChart } from '@/components/student/CareerRadarChart';
import type { StudentCommandCenterData } from '@/lib/student-command-center/types';
import type { UniversityThresholdProgress } from '@/lib/student-dashboard/university-threshold-progress';
import {
  motivationForProgress,
  parseTargetNumber,
  scoreGapProgress,
} from '@/lib/student-command-center/score-gap';

interface StudentCareerAcademicCockpitProps {
  data: StudentCommandCenterData;
}

function ThresholdBar({
  label,
  progress,
  formatValue,
}: {
  label: string;
  progress: UniversityThresholdProgress['sat'];
  formatValue: (n: number) => string;
}): ReactNode {
  if (progress.required === null) return null;

  const hasScore = progress.best !== null;
  const { percent } = scoreGapProgress(progress.best, progress.required);

  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-500">{progress.summaryLabel}</p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] ${
            progress.met
              ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
              : 'bg-gradient-to-r from-amber-400 via-indigo-400 to-violet-500'
          }`}
          style={{ width: `${progress.met ? 100 : percent}%` }}
        />
      </div>
      {hasScore && progress.required !== null ? (
        <p className="mt-1.5 text-[10px] tabular-nums text-slate-500">
          Sen: {formatValue(progress.best!)} · Baraj:{' '}
          {formatValue(progress.required)}
        </p>
      ) : null}
    </div>
  );
}

function UniversityThresholdCard({
  item,
}: {
  item: UniversityThresholdProgress;
}): ReactNode {
  const href = item.slug.trim()
    ? `/universities/${item.slug}`
    : '/universities';

  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={href}
            className="text-sm font-semibold text-slate-50 hover:text-indigo-200"
          >
            {item.name}
          </Link>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {item.city ? `${item.city}, ${item.country}` : item.country}
          </p>
        </div>
        {item.sat.met || item.ielts.met ? (
          <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
            Kısmen / tam baraj
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        <ThresholdBar
          label="Digital SAT"
          progress={item.sat}
          formatValue={(n) => String(Math.round(n))}
        />
        <ThresholdBar
          label="IELTS Academic"
          progress={item.ielts}
          formatValue={(n) => n.toFixed(1)}
        />
      </div>
    </article>
  );
}

export function StudentCareerAcademicCockpit({
  data,
}: StudentCareerAcademicCockpitProps): ReactNode {
  const { goals, career, universityThresholds, recentScores, matchScores } =
    data;
  const satTarget = parseTargetNumber(goals.targetScores.SAT);
  const ieltsTarget = parseTargetNumber(goals.targetScores.IELTS);

  const showPersonalTargets = satTarget !== null || ieltsTarget !== null;
  const showThresholds = universityThresholds.length > 0;

  return (
    <section
      aria-labelledby="career-academic-cockpit-heading"
      className="space-y-5 rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/[0.08] via-slate-950/85 to-violet-500/[0.07] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-indigo-200/90">
            <span aria-hidden>🎯</span>
            360° Kokpit
          </p>
          <h2
            id="career-academic-cockpit-heading"
            className="mt-1 text-lg font-semibold text-slate-50"
          >
            Kariyer & Akademik Kokpiti
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">
            Kariyer pusulası sonuçların, hedef üniversite barajları ve en yüksek
            resmi deneme skorların tek ekranda.
          </p>
        </div>
        {goals.organization ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            <Building2 className="size-4 shrink-0" />
            <span>{goals.organization.orgName}</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-violet-400/20 bg-slate-950/50 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-200/90">
            <Compass className="size-3.5" />
            Kariyer & yetkinlik özeti
          </p>

          {career.hasAssessment ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] text-slate-500">Holland kodu</p>
                <p className="mt-1 text-base font-semibold text-slate-50">
                  {career.hollandCode}{' '}
                  <span className="font-normal text-slate-400">
                    — {career.hollandTitle?.replace(/^[^:]+:\s*/, '')}
                  </span>
                </p>
              </div>
              {career.topTraits.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {career.topTraits.map((trait) => (
                    <span
                      key={trait}
                      className="rounded-full border border-violet-400/30 bg-violet-500/12 px-2.5 py-0.5 text-[10px] font-medium text-violet-100"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              ) : null}
              <CareerRadarChart data={career.radarData} />
              {career.primaryMajors.length > 0 ||
              career.secondaryMajors.length > 0 ? (
                <MajorMatchGroups
                  primaryMajors={career.primaryMajors}
                  secondaryMajors={career.secondaryMajors}
                  compact
                />
              ) : null}
              {career.aiInterpretation ? (
                <p className="line-clamp-4 text-xs leading-relaxed text-slate-400">
                  {career.aiInterpretation}
                </p>
              ) : null}
              <Link
                href="/career-compass"
                className="inline-flex text-xs font-medium text-indigo-300 hover:text-indigo-200"
              >
                Pusulayı yenile veya derinleştir →
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-amber-400/30 bg-amber-500/5 p-5 text-center">
              <p className="text-sm font-medium text-amber-100">
                Henüz Kariyer Pusulası çözülmedi
              </p>
              <p className="mt-2 text-xs text-slate-400">
                12 dakikalık hızlı envanter ile Holland profilin ve güçlü
                yönlerin burada görünür.
              </p>
              <Link
                href="/career-compass"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25"
              >
                <span aria-hidden>🚀</span>
                12 Dakikalık Pusulayı Başlat
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/50 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200/90">
            <GraduationCap className="size-3.5" />
            Hedef üniversite kabul barajları
          </p>

          {showThresholds ? (
            <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {universityThresholds.map((item) => (
                <UniversityThresholdCard key={item.universityId} item={item} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-5 text-center">
              <p className="text-sm text-slate-300">
                Henüz hedef üniversite pinlenmedi
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Bocconi, TUM, Polimi gibi okulları hedeflerine ekleyince SAT /
                IELTS baraj ilerlemen burada görünür.
              </p>
              <Link
                href="/student/dashboard?goals=open"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/12 px-4 py-2 text-xs font-semibold text-cyan-100"
              >
                <Target className="size-3.5" />
                Hedef üniversiteleri seç
              </Link>
            </div>
          )}

          {showPersonalTargets ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Kişisel hedef skorların
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {satTarget !== null ? (
                  <PersonalTargetChip
                    label="SAT"
                    current={recentScores.satScore ?? matchScores.satScore}
                    target={satTarget}
                    format={(n) => String(Math.round(n))}
                  />
                ) : null}
                {ieltsTarget !== null ? (
                  <PersonalTargetChip
                    label="IELTS"
                    current={recentScores.ieltsBand ?? matchScores.ieltsBand}
                    target={ieltsTarget}
                    format={(n) => n.toFixed(1)}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="mt-4 text-right text-[11px]">
            <Link href="/universities" className="text-sky-300 hover:underline">
              Üniversite rehberi →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function PersonalTargetChip({
  label,
  current,
  target,
  format,
}: {
  label: string;
  current: number | null;
  target: number;
  format: (n: number) => string;
}): ReactNode {
  const { percent } = scoreGapProgress(current, target);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[10px] text-slate-500">{label} hedefi</p>
      <p className="text-xs font-medium text-slate-200">
        {current !== null ? format(current) : '—'} / {format(target)}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {motivationForProgress(percent, current !== null)}
      </p>
    </div>
  );
}
