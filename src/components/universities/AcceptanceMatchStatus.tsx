'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Target } from 'lucide-react';
import type {
  StudentLatestScores,
  University,
} from '@/app/universities/actions';
import { FOUNDATION_GAP_NOTE } from '@/components/universities/FoundationPathwayBadge';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  caieGradeMeetsALevelThreshold,
  formatCaieGradeLabel,
  resolveUniversityAlevelRequirement,
} from '@/lib/universities/caie-grade';
import {
  loginUrlWithNext,
  STUDENT_CAIE_EXPLORE_PATH,
  STUDENT_DIAGNOSTIC_EXPLORE_PATH,
} from '@/lib/safe-next-path';

export type AcceptanceMatchVariant = 'compact' | 'detail';

interface AcceptanceMatchStatusProps {
  university: University;
  studentScores: StudentLatestScores;
  variant?: AcceptanceMatchVariant;
}

function ScoreLine({
  tone,
  children,
  compact,
}: {
  tone: 'pass' | 'gap' | 'cta';
  children: ReactNode;
  compact: boolean;
}): ReactNode {
  const styles = {
    pass: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100',
    gap: 'border-amber-400/35 bg-amber-500/10 text-amber-100',
    cta: 'border-sky-400/35 bg-sky-500/10 text-sky-100',
  }[tone];

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${compact ? 'text-[11px]' : 'text-sm'} leading-snug ${styles}`}
    >
      {children}
    </div>
  );
}

function DiagnosticExploreBridge(): ReactNode {
  const [href, setHref] = useState(
    loginUrlWithNext(STUDENT_DIAGNOSTIC_EXPLORE_PATH),
  );

  useEffect(() => {
    let cancelled = false;
    void createSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session?.user) {
          setHref(STUDENT_DIAGNOSTIC_EXPLORE_PATH);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
    >
      <Target className="size-4 shrink-0" />
      Teşhis Analizine Git — eksik konuları gör
    </Link>
  );
}

function CaieExploreCtaLink({ compact }: { compact: boolean }): ReactNode {
  const [href, setHref] = useState(
    loginUrlWithNext(STUDENT_CAIE_EXPLORE_PATH),
  );

  useEffect(() => {
    let cancelled = false;
    void createSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session?.user) {
          setHref(STUDENT_CAIE_EXPLORE_PATH);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline ${compact ? 'text-[11px]' : 'text-sm'}`}
    >
      <span aria-hidden>🔵</span>
      A-Level Denemesi Çöz
      <ArrowRight className="size-3.5 shrink-0" aria-hidden />
    </Link>
  );
}

function DiagnosticCtaLink({ compact }: { compact: boolean }): ReactNode {
  const [href, setHref] = useState(
    loginUrlWithNext(STUDENT_DIAGNOSTIC_EXPLORE_PATH),
  );

  useEffect(() => {
    let cancelled = false;
    void createSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled && data.session?.user) {
          setHref(STUDENT_DIAGNOSTIC_EXPLORE_PATH);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline ${compact ? 'text-[11px]' : 'text-sm'}`}
    >
      <span aria-hidden>🔵</span>
      Seviyeni Gör
      <ArrowRight className="size-3.5 shrink-0" aria-hidden />
      Kabul Şansını Hesapla
    </Link>
  );
}

export function AcceptanceMatchStatus({
  university,
  studentScores,
  variant = 'compact',
}: AcceptanceMatchStatusProps): ReactNode {
  const compact = variant === 'compact';
  const { satScore, ieltsBand, caieGrade } = studentScores;
  const minSat = university.min_sat_score;
  const minIelts = university.min_ielts_band;
  const minAlevelRequirement = resolveUniversityAlevelRequirement(university);

  const lines: ReactNode[] = [];

  if (satScore !== null && minSat !== null) {
    if (satScore >= minSat) {
      lines.push(
        <ScoreLine key="sat-pass" tone="pass" compact={compact}>
          <span aria-hidden>🟢 </span>
          Kabul Barajı Geçildi (Puanın: {satScore} / Baraj: {minSat})
        </ScoreLine>,
      );
    } else {
      const gap = minSat - satScore;
      lines.push(
        <ScoreLine key="sat-gap" tone="gap" compact={compact}>
          <span aria-hidden>🟡 </span>
          Hedefe {gap} Puan Kaldı (Puanın: {satScore} / Baraj: {minSat})
        </ScoreLine>,
      );
    }
  }

  if (ieltsBand !== null && minIelts !== null) {
    if (ieltsBand >= minIelts) {
      lines.push(
        <ScoreLine key="ielts-pass" tone="pass" compact={compact}>
          <span aria-hidden>🟢 </span>
          IELTS Barajı Geçildi (Band: {ieltsBand.toFixed(1)} / Baraj:{' '}
          {minIelts.toFixed(1)})
        </ScoreLine>,
      );
    } else {
      const gap = (minIelts - ieltsBand).toFixed(1);
      lines.push(
        <ScoreLine key="ielts-gap" tone="gap" compact={compact}>
          <span aria-hidden>🟡 </span>
          IELTS hedefe {gap} band kaldı (Band: {ieltsBand.toFixed(1)} / Baraj:{' '}
          {minIelts.toFixed(1)})
        </ScoreLine>,
      );
    }
  }

  if (minAlevelRequirement) {
    if (caieGrade) {
      if (caieGradeMeetsALevelThreshold(caieGrade)) {
        lines.push(
          <ScoreLine key="alevel-pass" tone="pass" compact={compact}>
            <span aria-hidden>🟢 </span>
            A-Level Barajını Karşılıyor (
            {formatCaieGradeLabel(caieGrade)} · Hedef: {minAlevelRequirement})
          </ScoreLine>,
        );
      } else {
        lines.push(
          <ScoreLine key="alevel-gap" tone="gap" compact={compact}>
            <span aria-hidden>🟡 </span>
            Hedef: {minAlevelRequirement} | Mevcut:{' '}
            {formatCaieGradeLabel(caieGrade)}
          </ScoreLine>,
        );
      }
    }
  }

  const needsAlevelCta = minAlevelRequirement !== null && caieGrade === null;

  const needsSatIeltsCta =
    (satScore === null && minSat !== null) ||
    (ieltsBand === null && minIelts !== null);

  const needsCta =
    (lines.length === 0 && !minAlevelRequirement) || needsSatIeltsCta;

  const hasGap =
    (satScore !== null && minSat !== null && satScore < minSat) ||
    (ieltsBand !== null && minIelts !== null && ieltsBand < minIelts) ||
    (caieGrade !== null &&
      minAlevelRequirement !== null &&
      !caieGradeMeetsALevelThreshold(caieGrade));

  const showDiagnosticBridge =
    variant === 'detail' && (needsCta || needsAlevelCta || hasGap);

  const showFoundationNote = university.has_foundation_pathway === true && hasGap;

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <p
        className={`font-semibold text-slate-300 ${compact ? 'text-[10px] uppercase tracking-wide' : 'text-xs uppercase tracking-wide'}`}
      >
        Kabul Şansı Durumu
      </p>
      {lines.length > 0 ? <div className="space-y-2">{lines}</div> : null}
      {showFoundationNote ? (
        <div
          className={`rounded-lg border border-teal-400/35 bg-teal-500/10 px-3 py-2 leading-snug text-teal-100 ${compact ? 'text-[11px]' : 'text-sm'}`}
        >
          <span aria-hidden>🎓 </span>
          {FOUNDATION_GAP_NOTE}
        </div>
      ) : null}
      {needsAlevelCta ? (
        <ScoreLine tone="cta" compact={compact}>
          <CaieExploreCtaLink compact={compact} />
        </ScoreLine>
      ) : null}
      {needsCta ? (
        <ScoreLine tone="cta" compact={compact}>
          <DiagnosticCtaLink compact={compact} />
        </ScoreLine>
      ) : null}
      {showDiagnosticBridge ? (
        <DiagnosticExploreBridge />
      ) : null}
      {variant === 'detail' && needsCta && lines.length === 0 ? (
        <p className="text-xs leading-relaxed text-slate-500">
          15 dakikalık teşhis ile SAT/IELTS seviyeni ölç; baraj karşılaştırması
          otomatik güncellenir.
        </p>
      ) : null}
    </div>
  );
}
