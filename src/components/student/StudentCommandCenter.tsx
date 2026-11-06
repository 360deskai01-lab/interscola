'use client';

import Link from 'next/link';
import { Building2, Radar, Target } from 'lucide-react';
import { FoundationPathwayBadge } from '@/components/universities/FoundationPathwayBadge';
import { UniversityCardMediaHeader } from '@/components/universities/UniversityVisualMedia';
import type { ReactNode } from 'react';
import type { StudentCommandCenterData } from '@/lib/student-command-center/types';
import {
  motivationForProgress,
  parseTargetNumber,
  scoreGapProgress,
} from '@/lib/student-command-center/score-gap';
import {
  computeUniversityMatchBadge,
  type UniversityMatchBadge,
} from '@/lib/student-command-center/university-match';
import type { University } from '@/lib/universities/types';

interface StudentCommandCenterProps {
  data: StudentCommandCenterData;
}

function MatchBadge({ status }: { status: UniversityMatchBadge }): ReactNode {
  if (status === 'met') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
        <span aria-hidden>🟢</span>
        Baraj karşılanıyor
      </span>
    );
  }
  if (status === 'gap') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
        <span aria-hidden>🟡</span>
        Eksik var
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
      Skor / veri gerekli
    </span>
  );
}

function ScoreGapBar({
  label,
  current,
  target,
  unit,
  formatValue,
}: {
  label: string;
  current: number | null;
  target: number | null;
  unit: string;
  formatValue: (value: number) => string;
}): ReactNode {
  if (target === null) return null;

  const { percent, remaining, exceeded } = scoreGapProgress(current, target);
  const hasScore = current !== null;

  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-50">
            {hasScore ? formatValue(current) : '—'}
            <span className="text-sm font-normal text-slate-500">
              {' '}
              / hedef {formatValue(target)} {unit}
            </span>
          </p>
        </div>
        {exceeded ? (
          <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-100">
            Hedef aşıldı
          </span>
        ) : remaining !== null && hasScore ? (
          <span className="rounded-full border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-100">
            Hedefe kalan: +{formatValue(remaining)} {unit}
          </span>
        ) : (
          <span className="rounded-full border border-slate-500/30 bg-white/[0.04] px-2.5 py-1 text-xs text-slate-400">
            Deneme bekleniyor
          </span>
        )}
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-500 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        {motivationForProgress(percent, hasScore)}
      </p>
    </article>
  );
}

function PinnedUniversityCard({
  university,
  badge,
}: {
  university: University;
  badge: UniversityMatchBadge;
}): ReactNode {
  const href = university.slug.trim()
    ? `/universities/${university.slug}`
    : '/universities';

  const location = university.city?.trim()
    ? `${university.city}, ${university.country}`
    : university.country;

  return (
    <Link
      href={href}
      className="flex min-w-[220px] max-w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 transition hover:border-indigo-400/30 hover:bg-white/[0.04]"
    >
      <UniversityCardMediaHeader
        university={university}
        coverHeightClass="h-[120px]"
      />
      <div className="flex flex-1 flex-col p-4">
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-50">
          {university.name}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-500">{location}</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <dt className="text-slate-500">Min SAT</dt>
          <dd className="font-semibold tabular-nums text-slate-100">
            {university.min_sat_score ?? '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
          <dt className="text-slate-500">Min IELTS</dt>
          <dd className="font-semibold tabular-nums text-slate-100">
            {university.min_ielts_band !== null
              ? university.min_ielts_band.toFixed(1)
              : '—'}
          </dd>
        </div>
      </dl>
      <div className="mt-3 space-y-1.5">
        <MatchBadge status={badge} />
        <FoundationPathwayBadge university={university} compact />
      </div>
      </div>
    </Link>
  );
}

export function StudentCommandCenter({
  data,
}: StudentCommandCenterProps): ReactNode {
  const { goals, pinnedUniversities, recentScores, matchScores } = data;
  const satTarget = parseTargetNumber(goals.targetScores.SAT);
  const ieltsTarget = parseTargetNumber(goals.targetScores.IELTS);

  const showRadar = satTarget !== null || ieltsTarget !== null;
  const showPinned = pinnedUniversities.length > 0;

  if (!showRadar && !showPinned && !goals.organization) {
    return null;
  }

  return (
    <section
      aria-labelledby="command-center-heading"
      className="space-y-5 rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/[0.07] via-slate-950/80 to-violet-500/[0.06] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-indigo-200/90">
            <Radar className="size-3.5" />
            Dashboard V2
          </p>
          <h2
            id="command-center-heading"
            className="mt-1 text-lg font-semibold text-slate-50"
          >
            Komuta merkezi
          </h2>
          <p className="mt-1 max-w-xl text-xs text-slate-400">
            Hedef skorların, pinlediğin üniversiteler ve son deneme sonuçların
            tek ekranda.
          </p>
        </div>
        {goals.organization ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            <Building2 className="size-4 shrink-0" />
            <span>{goals.organization.orgName}</span>
          </div>
        ) : null}
      </div>

      {showRadar ? (
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Target className="size-3.5 text-cyan-300" />
            Skor radarı & hedef çubuğu
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {satTarget !== null ? (
              <ScoreGapBar
                label="Digital SAT"
                current={recentScores.satScore}
                target={satTarget}
                unit="puan"
                formatValue={(v) => String(Math.round(v))}
              />
            ) : null}
            {ieltsTarget !== null ? (
              <ScoreGapBar
                label="IELTS Academic"
                current={recentScores.ieltsBand}
                target={ieltsTarget}
                unit="band"
                formatValue={(v) => v.toFixed(1)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {showPinned ? (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pinlenmiş hedef üniversiteler
          </p>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pinnedUniversities.map((university) => (
              <PinnedUniversityCard
                key={university.id}
                university={university}
                badge={computeUniversityMatchBadge(university, matchScores)}
              />
            ))}
          </div>
          <p className="mt-2 text-right text-[11px] text-slate-500">
            <Link href="/universities" className="text-sky-300 hover:underline">
              Tüm üniversite rehberi →
            </Link>
          </p>
        </div>
      ) : null}
    </section>
  );
}
