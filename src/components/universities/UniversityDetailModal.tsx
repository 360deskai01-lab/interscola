'use client';

import { useEffect, type ReactNode } from 'react';
import {
  CalendarClock,
  ExternalLink,
  GraduationCap,
  Home,
  MapPin,
  Wallet,
  ClipboardList,
  Award,
  X,
} from 'lucide-react';
import type {
  StudentLatestScores,
  University,
} from '@/app/universities/actions';
import { AcceptanceMatchStatus } from '@/components/universities/AcceptanceMatchStatus';
import { DiagnosticExploreLink } from '@/components/universities/DiagnosticExploreLink';
import { UniversityHeroBanner } from '@/components/universities/UniversityVisualMedia';

interface UniversityDetailModalProps {
  isOpen: boolean;
  university: University | null;
  studentScores: StudentLatestScores;
  onClose: () => void;
}

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

function InfoHighlightCard({
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
    <div
      className={`rounded-xl border bg-gradient-to-br p-4 ${accent}`}
    >
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        {icon}
        {title}
      </h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
        {body}
      </p>
    </div>
  );
}

export function UniversityDetailModal({
  isOpen,
  university,
  studentScores,
  onClose,
}: UniversityDetailModalProps): ReactNode {
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !university) {
    return null;
  }

  const ieltsDisplay =
    university.min_ielts_band !== null
      ? university.min_ielts_band.toFixed(1)
      : '—';
  const satDisplay =
    university.min_sat_score !== null ? String(university.min_sat_score) : '—';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="university-detail-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-indigo-400/20 bg-gradient-to-b from-slate-900 via-slate-950 to-indigo-950/50 shadow-2xl shadow-indigo-950/40 sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <UniversityHeroBanner
          university={university}
          coverHeightClass="h-36 sm:h-40"
        />
        <div className="flex items-start gap-3 border-b border-white/10 px-5 pb-4 pt-12">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2">
              <h2
                id="university-detail-title"
                className="text-lg font-semibold text-slate-50"
              >
                {university.name}
              </h2>
              {university.website_url ? (
                <a
                  href={university.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-slate-300 transition hover:border-sky-400/40 hover:text-sky-100"
                  aria-label="Resmi web sitesi"
                >
                  <ExternalLink className="size-3.5" />
                  Resmi site
                </a>
              ) : null}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{university.country}</span>
              {university.city ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="size-3" aria-hidden />
                    {university.city}
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <AcceptanceMatchStatus
              university={university}
              studentScores={studentScores}
              variant="detail"
            />
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-200">
              <GraduationCap className="size-4" />
              Akademik Kabul Şartları
            </h3>
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
            {university.description ? (
              <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-300">
                <span className="font-medium text-slate-200">Program özeti: </span>
                {university.description}
              </p>
            ) : null}
          </section>

          <section className="grid gap-3">
            {university.scholarship_info?.trim() ? (
              <InfoHighlightCard
                title="Burs & Finansal Destek"
                icon={
                  <>
                    <span aria-hidden>🎓</span>
                    <Award className="size-4 text-emerald-300" />
                  </>
                }
                body={university.scholarship_info.trim()}
                accent="border-emerald-400/30 from-emerald-500/10 via-indigo-500/10 to-slate-950/80"
              />
            ) : null}
            {university.local_exam_requirements?.trim() ? (
              <InfoHighlightCard
                title="Ek / Yerel Sınav Koşulları"
                icon={
                  <>
                    <span aria-hidden>📋</span>
                    <ClipboardList className="size-4 text-indigo-300" />
                  </>
                }
                body={university.local_exam_requirements.trim()}
                accent="border-indigo-400/35 from-indigo-500/12 to-slate-950/80"
              />
            ) : null}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-200">
              <Wallet className="size-4" />
              Maliyet & Yaşam Analizi
            </h3>
            <dl className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Yıllık harç aralığı</dt>
                <dd className="mt-0.5 font-medium text-slate-100">
                  {displayText(university.tuition_fee_range)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Aylık yaşam maliyeti</dt>
                <dd className="mt-0.5 font-medium text-slate-100">
                  {displayText(university.monthly_living_cost)}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-slate-500">
                  <Home className="size-3" aria-hidden />
                  Konaklama & yurt bilgisi
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-slate-300">
                  {displayText(university.accommodation_info)}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-200">
              <CalendarClock className="size-4" />
              Başvuru Takvimi & Önemli Tarihler
            </h3>
            <p className="whitespace-pre-wrap rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm leading-relaxed text-amber-50/90">
              {displayText(university.application_deadlines)}
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 bg-slate-950/60 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            Kapat
          </button>
          <DiagnosticExploreLink
            label="Bu Üniversite İçin Kabul Şansını Ölç (15 Dk Teşhis)"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25 sm:min-w-[280px]"
          />
        </div>
      </div>
    </div>
  );
}
