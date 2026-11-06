'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  Landmark,
  Loader2,
  Rocket,
  Timer,
  Zap,
} from 'lucide-react';
import type { PublicLibraryItem } from '@/app/student/public-library-actions';
import { LibraryNewBadge } from '@/components/exam/LibraryNewBadge';
import {
  DIAGNOSTIC_DRILL_DURATION_MINUTES,
  MINI_MOCK_DURATION_MINUTES,
  questionCountForSessionFormat,
} from '@/lib/exam/exam-session-formats';
import {
  exploreModeForFormat,
  type LibraryExploreMode,
} from '@/lib/exam/library-exam-format';
import { isLibraryRecentlyAdded } from '@/lib/public-library/library-new-badge';
import type { CurriculumCode } from '@/types/exam';

type ExploreFilter = 'ALL' | 'SAT' | 'IELTS' | 'CAIE';

const MODE_OPTIONS: {
  id: LibraryExploreMode;
  label: string;
  emoji: string;
}[] = [
  { id: 'quick', label: 'Hızlı Pratikler & Mini Denemeler', emoji: '⏱️' },
  { id: 'full', label: 'Resmi Tam Simülasyonlar', emoji: '🏛️' },
];

function isCurriculumCode(value: string): value is CurriculumCode {
  return value === 'SAT' || value === 'IELTS' || value === 'CAIE';
}

/** Oturum başlarken uygulanan soru sayısı; hazır payload daha kısaysa onunla sınırlı. */
function sessionQuestionCount(
  item: PublicLibraryItem,
  format: 'diagnostic_drill' | 'mini_mock',
): number | null {
  const code = item.curriculum.toUpperCase();
  if (!isCurriculumCode(code)) return item.storedQuestionCount;
  const target = questionCountForSessionFormat(format, code);
  return item.storedQuestionCount !== null
    ? Math.min(target, item.storedQuestionCount)
    : target;
}

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
  onStartFullMock: (libraryId: string) => Promise<{
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
  onStartFullMock,
  onStartDiagnostic,
  primaryCurriculumLabel,
  searchQuery = '',
}: StudentExploreSectionProps): ReactNode {
  const router = useRouter();
  const [mode, setMode] = useState<LibraryExploreMode>('quick');
  const [filter, setFilter] = useState<ExploreFilter>('ALL');
  const [pending, startTransition] = useTransition();
  const [busyLibraryId, setBusyLibraryId] = useState<string | null>(null);
  const [busyLibraryMode, setBusyLibraryMode] = useState<
    'mini' | 'drill' | 'full' | null
  >(null);
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modeCounts = useMemo(() => {
    let quick = 0;
    let full = 0;
    for (const item of libraries) {
      if (exploreModeForFormat(item.examFormat) === 'full') full += 1;
      else quick += 1;
    }
    return { quick, full } satisfies Record<LibraryExploreMode, number>;
  }, [libraries]);

  const filteredLibraries = useMemo(() => {
    const byMode = libraries.filter(
      (item) => exploreModeForFormat(item.examFormat) === mode,
    );
    const byCurriculum =
      filter === 'ALL'
        ? byMode
        : byMode.filter((item) => item.curriculum.toUpperCase() === filter);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byCurriculum;
    return byCurriculum.filter((item) => {
      const haystack = [item.title, item.curriculum, item.subject ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, libraries, mode, searchQuery]);

  function goToExam(assignmentId: string) {
    router.push(`/exam-session/${assignmentId}`);
  }

  function handleStartLibrary(
    libraryId: string,
    startMode: 'mini' | 'drill' | 'full',
    action: (id: string) => Promise<{
      success: boolean;
      error?: string;
      assignmentId?: string;
    }>,
  ) {
    setError(null);
    setBusyLibraryId(libraryId);
    setBusyLibraryMode(startMode);
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
        setError(
          result.error ??
            'Sıfırıncı gün hızlı seviye belirleme testi başlatılamadı.',
        );
        return;
      }
      goToExam(result.assignmentId);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-violet-500/10 p-5">
        <p className="text-sm font-semibold text-slate-100">
          🎯 Sıfırıncı Gün Hızlı Seviye Belirleme Testi (Diagnostic • 5–15 Dk)
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Kapsamlı bir denemeye girmeden önce 5 dakikada başlangıç seviyeni ölç,
          güçlü ve zayıf kazanımlarını (Weakness Ledger) anında gör.
          {primaryCurriculumLabel ? ` Öncelik: ${primaryCurriculumLabel}.` : ''}
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
            Testi başlat
          </button>
          <span className={`${badgeClass} border-slate-500/30 text-slate-400`}>
            5–15 dk · Mikro oturum
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

      <div
        role="tablist"
        aria-label="Kütüphane modu"
        className="grid gap-1 rounded-xl border border-white/10 bg-slate-950/60 p-1 sm:grid-cols-2"
      >
        {MODE_OPTIONS.map((option) => {
          const active = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(option.id)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition sm:text-sm ${
                active
                  ? 'bg-gradient-to-r from-indigo-500/30 to-violet-500/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
              }`}
            >
              <span aria-hidden>{option.emoji}</span>
              {option.label}
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 text-[10px] tabular-nums text-slate-300">
                {modeCounts[option.id]}
              </span>
            </button>
          );
        })}
      </div>

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
            {mode === 'full'
              ? 'Bu filtrede resmi tam simülasyon henüz yayınlanmadı.'
              : 'Bu filtrede doğrulanmış açık materyal henüz yok.'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {mode === 'full'
              ? 'Tam simülasyonlar hazır olduğunda burada listelenir; şimdilik Hızlı Pratikler sekmesini kullanabilirsin.'
              : 'Hedef sınavını kayıtta seçtiysen ilgili havuz otomatik filtrelenir.'}
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
                  {item.lastResult?.solved ? (
                    <span
                      className={`${badgeClass} gap-1 border-emerald-400/45 bg-emerald-500/20 text-emerald-50`}
                    >
                      <CheckCircle2 className="size-3" aria-hidden />
                      Çözüldü
                      {item.lastResult.scaledResult
                        ? ` · Son skor: ${item.lastResult.scaledResult}`
                        : ''}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mode === 'full' ? (
                    <>
                      <span
                        className={`${badgeClass} gap-1 border-amber-400/35 bg-amber-500/10 text-amber-100`}
                      >
                        <Timer className="size-3" aria-hidden />
                        {item.fullMockDurationMinutes} Dk
                      </span>
                      {item.storedQuestionCount !== null ? (
                        <span
                          className={`${badgeClass} border-slate-500/30 bg-slate-500/10 text-slate-300`}
                        >
                          {item.storedQuestionCount} Soru
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span
                        className={`${badgeClass} gap-1 border-amber-400/35 bg-amber-500/10 text-amber-100`}
                      >
                        <Clock className="size-3" aria-hidden />
                        {DIAGNOSTIC_DRILL_DURATION_MINUTES}–
                        {MINI_MOCK_DURATION_MINUTES} Dk
                      </span>
                      <span
                        className={`${badgeClass} border-slate-500/30 bg-slate-500/10 text-slate-300`}
                      >
                        {sessionQuestionCount(item, 'diagnostic_drill') ?? '—'}
                        –{sessionQuestionCount(item, 'mini_mock') ?? '—'} Soru
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {mode === 'full' ? (
                  <button
                    type="button"
                    disabled={pending || !item.hasExam}
                    onClick={() =>
                      handleStartLibrary(item.id, 'full', onStartFullMock)
                    }
                    className={`${btnClass} w-full border-amber-400/40 bg-amber-500/12 text-amber-100 hover:bg-amber-500/22`}
                  >
                    {pending &&
                    busyLibraryId === item.id &&
                    busyLibraryMode === 'full' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Landmark className="size-3.5" />
                    )}
                    {item.lastResult?.solved
                      ? 'Tam Simülasyonu Tekrarla'
                      : 'Tam Simülasyonu Başlat'}
                  </button>
                ) : (
                  <>
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
                        handleStartLibrary(
                          item.id,
                          'drill',
                          onStartDiagnosticDrill,
                        )
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
                      🎯 Sıfırıncı Gün · 5–15 dk
                    </button>
                  </>
                )}
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
