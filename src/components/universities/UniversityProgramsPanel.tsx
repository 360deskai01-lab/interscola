'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Filter, Languages, Scale } from 'lucide-react';
import type { UniversityProgram } from '@/types/university';

const DEGREE_FILTERS: {
  id: 'all' | 'bachelor' | 'master' | 'doctoral';
  label: string;
}[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'bachelor', label: 'Lisans' },
  { id: 'master', label: 'Yüksek Lisans' },
  { id: 'doctoral', label: 'Doktora' },
];

function formatDeadline(isoDate: string | null): string {
  if (!isoDate?.trim()) return '—';
  const d = new Date(`${isoDate.trim().slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatIelts(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

export function UniversityProgramsPanel({
  programs,
}: {
  programs: UniversityProgram[];
}): ReactNode {
  const [degree, setDegree] = useState<(typeof DEGREE_FILTERS)[number]['id']>(
    'all',
  );

  const filtered = useMemo(() => {
    if (degree === 'all') return programs;
    return programs.filter((p) => p.degree_level === degree);
  }, [programs, degree]);

  if (programs.length === 0) {
    return (
      <section
        aria-labelledby="programs-heading"
        className="rounded-lg border border-white/10 bg-slate-900/40 p-5"
      >
        <h2
          id="programs-heading"
          className="flex items-center gap-2 text-base font-semibold text-slate-100"
        >
          <BookOpen className="size-5 text-indigo-300" />
          Bölümler & Kabul Barajları
        </h2>
        <p className="mt-3 text-sm text-slate-500">
          Bu kurum için program satırları henüz eklenmemiş veya rehber veritabanı
          senkronu bekleniyor.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="programs-heading"
      className="rounded-lg border border-white/10 bg-slate-900/40 p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="programs-heading"
            className="flex items-center gap-2 text-base font-semibold text-slate-100"
          >
            <BookOpen className="size-5 text-indigo-300" />
            Bölümler & Kabul Barajları
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Program bazlı SAT / IELTS barajları ve başvuru tarihleri (Uni4Edu
            rehberi).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Filter className="size-3.5" />
            Düzey
          </span>
          <div className="flex flex-wrap gap-1.5">
            {DEGREE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDegree(f.id)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                  degree === f.id
                    ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-50'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Bu filtreye uygun program yok.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-100">{p.program_name}</p>
                  {p.faculty ? (
                    <p className="mt-0.5 text-xs text-slate-500">{p.faculty}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-md border border-white/10 bg-slate-950/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {p.degree_level === 'bachelor'
                    ? 'Lisans'
                    : p.degree_level === 'master'
                      ? 'Yüksek Lisans'
                      : p.degree_level === 'doctoral'
                        ? 'Doktora'
                        : 'Diğer'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/25 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-100">
                  <span className="text-sky-400/80">SAT</span>
                  {p.min_sat_math !== null || p.min_sat_rw !== null ? (
                    <span>
                      Toplam {p.min_sat_score ?? '—'}
                      {(p.min_sat_math !== null || p.min_sat_rw !== null) && (
                        <span className="text-sky-200/80">
                          {' '}
                          (M {p.min_sat_math ?? '—'} · RW {p.min_sat_rw ?? '—'})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>{p.min_sat_score ?? '—'}</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-100">
                  <Languages className="size-3 text-violet-300/80" />
                  IELTS {formatIelts(p.min_ielts_score)}
                  {p.min_ielts_subscore !== null ? (
                    <span className="text-violet-200/75">
                      {' '}
                      (min. alt {formatIelts(p.min_ielts_subscore)})
                    </span>
                  ) : null}
                </span>
                {p.min_gpa ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-100">
                    <Scale className="size-3 text-emerald-300/80" />
                    GPA {p.min_gpa}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-50">
                  Son başvuru {formatDeadline(p.application_deadline)}
                </span>
              </div>

              {p.english_waiver_policy ? (
                <div className="mt-3 rounded-md border border-indigo-400/20 bg-indigo-500/[0.08] px-3 py-2 text-xs leading-relaxed text-indigo-100/95">
                  <span className="font-semibold text-indigo-200">
                    Dil muafiyeti:{' '}
                  </span>
                  {p.english_waiver_policy}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
