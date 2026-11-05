'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Compass, Loader2, Rocket, Zap } from 'lucide-react';
import type { PublicLibraryItem } from '@/app/student/public-library-actions';
import { LibraryNewBadge } from '@/components/exam/LibraryNewBadge';
import { isLibraryRecentlyAdded } from '@/lib/public-library/library-new-badge';

type ExploreFilter = 'ALL' | 'SAT' | 'IELTS' | 'CAIE';

const FILTER_OPTIONS: { id: ExploreFilter; label: string }[] = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'SAT', label: 'Digital SAT' },
  { id: 'IELTS', label: 'IELTS Academic' },
  { id: 'CAIE', label: 'CAIE A-Level' },
];

const badgeClass =
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight';
const btnClass =
  'inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50';

interface StudentExploreSectionProps {
  libraries: PublicLibraryItem[];
  onStartMiniMock: (libraryId: string) => Promise<{
    success: boolean;
    error?: string;
    assignmentId?: string;
  }>;
  onStartDiagnosticDrill: (libraryId: string) => Promise<{
    success: boolean;
    error?: string;
    assignmentId?: string;
  }>;
  onStartDiagnostic: () => Promise<{
    success: boolean;
    error?: string;
    assignmentId?: string;
  }>;
  primaryCurriculumLabel?: string;
  searchQuery?: string;
}

export function StudentExploreSection({
  libraries,
  onStartMiniMock,
  onStartDiagnosticDrill,
  onStartDiagnostic,
  primaryCurriculumLabel,
  searchQuery = '',
}: StudentExploreSectionProps): ReactNode {
  const router = useRouter();
  const [filter, setFilter] = useState<ExploreFilter>('ALL');
  const [pending, startTransition] = useTransition();
  const [busyLibraryId, setBusyLibraryId] = useState<string | null>(null);
  const [busyLibraryMode, setBusyLibraryMode] = useState<
    'mini' | 'drill' | null
  >(null);
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredLibraries = useMemo(() => {
    const byCurriculum =
      filter === 'ALL'
        ? libraries
        : libraries.filter(
            (item) => item.curriculum.toUpperCase() === filter,
          );
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byCurriculum;
    return byCurriculum.filter((item) => {
      const haystack = [item.title, item.curriculum, item.subject ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, libraries, searchQuery]);

  function goToExam(assignmentId: string) {
    router.push(`/exam-session/${assignmentId}`);
  }

  function handleStartLibrary(
    libraryId: string,
    mode: 'mini' | 'drill',
    action: (id: string) => Promise<{
      success: boolean;
      error?: string;
      assignmentId?: string;
    }>,
  ) {
    setError(null);
    setBusyLibraryId(libraryId);
    setBusyLibraryMode(mode);
    startTransition(async () => {
      const result = await action(libraryId);
      setBusyLibraryId(null);
      setBusyLibraryMode(null);
      if (!result.success || !result.assignmentId) {
        setError(result.error ?? 'Oturum başlatılamadı.');
        return;
      }
      goToExam(result.assignmentId);
    });
  }

  function handleSmartDiagnostic() {
    setError(null);
    setDiagnosticBusy(true);
    startTransition(async () => {
      const result = await onStartDiagnostic();
      setDiagnosticBusy(false);
      if (!result.success || !result.assignmentId) {
        setError(result.error ?? 'Diagnostic Drill başlatılamadı.');
        return;
      }
      goToExam(result.assignmentId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-violet-500/10 p-5">
        <p className="text-sm font-semibold text-slate-100">
          Diagnostic Drill (Mikro Alıştırma · 3–5 Soru)
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Hedef sınavına göre kısa hızlı seviye tespiti — resmi tam sınav
          değildir
          {primaryCurriculumLabel
            ? ` · öncelik: ${primaryCurriculumLabel}`
            : ' · varsayılan: Digital SAT'}
          . Sonuçlar gelişim grafiğine yansır.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleSmartDiagnostic}
            className={`${btnClass} border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-xs text-cyan-100 hover:bg-cyan-500/25`}
          >
            {pending && diagnosticBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5" />
            )}
            Diagnostic Drill Başlat
          </button>
          <span className={`${badgeClass} border-slate-500/30 text-slate-400`}>
            ~15 dk · Mikro
          </span>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
              filter === option.id
                ? 'border-indigo-400/50 bg-indigo-500/20 text-indigo-100'
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredLibraries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
          <Compass className="mx-auto size-8 text-slate-700" />
          <p className="mt-3 text-sm text-slate-400">
            Bu filtrede doğrulanmış açık materyal henüz yok.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Hedef sınavını kayıtta seçtiysen ilgili havuz otomatik filtrelenir.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {filteredLibraries.map((item) => (
            <li
              key={item.id}
              className="flex flex-col rounded-xl border border-white/10 bg-slate-950/40 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-medium text-slate-100">{item.title}</h3>
                  {isLibraryRecentlyAdded(item.createdAt) ? (
                    <LibraryNewBadge className="shrink-0" />
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={`${badgeClass} border-sky-400/35 bg-sky-500/12 text-sky-100`}
                  >
                    {FILTER_OPTIONS.find(
                      (f) => f.id === item.curriculum.toUpperCase(),
                    )?.label ?? item.curriculum}
                  </span>
                  {item.subject ? (
                    <span
                      className={`${badgeClass} border-slate-500/30 bg-slate-500/10 text-slate-300`}
                    >
                      {item.subject}
                    </span>
                  ) : null}
                  {item.hasExam ? (
                    <span
                      className={`${badgeClass} border-emerald-400/30 bg-emerald-500/10 text-emerald-100`}
                    >
                      Oturum hazır
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={pending || !item.hasExam}
                  onClick={() =>
                    handleStartLibrary(item.id, 'mini', onStartMiniMock)
                  }
                  className={`${btnClass} w-full border-fuchsia-400/40 bg-fuchsia-500/12 text-fuchsia-100 hover:bg-fuchsia-500/22`}
                >
                  {pending &&
                  busyLibraryId === item.id &&
                  busyLibraryMode === 'mini' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Rocket className="size-3.5" />
                  )}
                  Mini Deneme (10–12 Soru · ~18 dk)
                </button>
                <button
                  type="button"
                  disabled={pending || !item.hasExam}
                  onClick={() =>
                    handleStartLibrary(item.id, 'drill', onStartDiagnosticDrill)
                  }
                  className={`${btnClass} w-full border-cyan-400/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20`}
                >
                  {pending &&
                  busyLibraryId === item.id &&
                  busyLibraryMode === 'drill' ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Zap className="size-3.5" />
                  )}
                  Diagnostic Drill (Mikro · 3–5 Soru)
                </button>
              </div>
              {!item.hasExam ? (
                <p className="mt-2 text-[10px] text-slate-500">
                  Bu kart için yeterli metin / sınav verisi yok.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
