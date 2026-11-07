'use client';

import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { OfficialExamRadarData } from '@/types/exam-radar';

function formatDateChip(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(`${iso.trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function capacityBadgeLabel(status: 'available' | 'limited'): string {
  return status === 'limited' ? 'Sınırlı' : 'Uygun';
}

function capacityBadgeClass(status: 'available' | 'limited'): string {
  return status === 'limited'
    ? 'border-amber-400/35 bg-amber-500/15 text-amber-100'
    : 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100';
}

export interface ExamRadarWidgetProps {
  initialData: OfficialExamRadarData | null;
}

export function ExamRadarWidget({ initialData }: ExamRadarWidgetProps): ReactNode {
  const [expanded, setExpanded] = useState(false);

  const exam = initialData?.nearestExam ?? null;
  const centers = initialData?.centers ?? [];
  const userCity = initialData?.userCity?.trim() || null;

  const deadlineLabel = useMemo(
    () => formatDateChip(exam?.registrationCloseDate),
    [exam?.registrationCloseDate],
  );

  if (!exam) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-500 backdrop-blur">
        Resmi sınav takvimi henüz yayımlanmadı veya kayıt bulunmuyor. Takvim
        güncellendiğinde burada görünecek.
      </div>
    );
  }

  const cityHeading = userCity
    ? `${userCity} için en yakın yetkili sınav merkezleri`
    : 'En yakın yetkili sınav merkezleri';

  return (
    <div className="overflow-hidden rounded-lg border border-cyan-400/25 bg-gradient-to-br from-cyan-950/40 via-slate-950/60 to-indigo-950/40 shadow-lg shadow-cyan-900/20 backdrop-blur">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04]"
        aria-expanded={expanded}
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-md bg-cyan-500/20 text-lg"
          aria-hidden
        >
          🎯
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-200/80">
            Yaklaşan resmi sınav
            {exam.isProjected ? (
              <span className="ml-1.5 normal-case text-amber-200/90">
                · takvim projeksiyonu
              </span>
            ) : null}
          </p>
          <p className="truncate text-sm font-semibold text-slate-100">
            {exam.examName}
            <span className="text-slate-400"> — </span>
            <span className="tabular-nums text-cyan-100">
              {exam.daysRemaining} gün kaldı
            </span>
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="size-5 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="size-5 shrink-0 text-slate-400" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-white/10 px-4 py-3 text-sm">
          <p className="text-xs text-slate-400">
            <span className="font-medium text-slate-300">Son başvuru tarihi: </span>
            {deadlineLabel}
          </p>

          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <MapPin className="size-3.5 text-cyan-400/90" aria-hidden />
              <span aria-hidden>📍</span> {cityHeading}
            </p>
            {centers.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Bu sınav için merkez listesi henüz eklenmedi.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {centers.slice(0, 6).map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/8 bg-white/[0.03] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-200">
                        {c.centerName}
                      </p>
                      <p className="text-[11px] text-slate-500">{c.city}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${capacityBadgeClass(
                        c.capacityStatus,
                      )}`}
                    >
                      Kontenjan: {capacityBadgeLabel(c.capacityStatus)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
