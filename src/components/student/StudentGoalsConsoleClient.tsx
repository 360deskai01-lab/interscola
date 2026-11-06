'use client';

import {
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  GraduationCap,
  Loader2,
  Tag,
  Target,
  X,
} from 'lucide-react';
import type {
  StudentGoalsContext,
  UpdateStudentGoalsPayload,
} from '@/lib/student-profile/types';
import { updateStudentGoalsAction } from '@/app/student/profile-actions';
import { StudentHubNav } from '@/components/student/StudentHubNav';

const PRESET_INTEREST_TAGS = [
  'Yapay Zeka',
  'Finans',
  'Hukuk',
  'Tıp',
  'Mühendislik',
  'Psikoloji',
  'Uluslararası İlişkiler',
  'Veri Bilimi',
  'Sürdürülebilirlik',
  'Girişimcilik',
] as const;

interface StudentGoalsConsoleClientProps {
  initialContext: StudentGoalsContext;
}

function scoreInputValue(
  scores: StudentGoalsContext['targetScores'],
  key: 'SAT' | 'IELTS',
): string {
  const raw = scores[key];
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

export function StudentGoalsConsoleClient({
  initialContext,
}: StudentGoalsConsoleClientProps): ReactNode {
  const [context, setContext] = useState(initialContext);
  const [satTarget, setSatTarget] = useState(() =>
    scoreInputValue(initialContext.targetScores, 'SAT'),
  );
  const [ieltsTarget, setIeltsTarget] = useState(() =>
    scoreInputValue(initialContext.targetScores, 'IELTS'),
  );
  const [selectedUniversityIds, setSelectedUniversityIds] = useState<string[]>(
    () => [...initialContext.targetUniversityIds],
  );
  const [interestTags, setInterestTags] = useState<string[]>(() => [
    ...initialContext.interestTags,
  ]);
  const [tagInput, setTagInput] = useState('');
  const [universityQuery, setUniversityQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredUniversities = useMemo(() => {
    const q = universityQuery.trim().toLowerCase();
    if (!q) return context.universities;
    return context.universities.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q) ||
        (u.city?.toLowerCase().includes(q) ?? false),
    );
  }, [context.universities, universityQuery]);

  function toggleUniversity(id: string) {
    setSelectedUniversityIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function addTag(raw: string) {
    const t = raw.trim();
    if (t.length < 2 || t.length > 64) return;
    const key = t.toLowerCase();
    setInterestTags((current) => {
      if (current.some((x) => x.toLowerCase() === key)) return current;
      if (current.length >= 32) return current;
      return [...current, t];
    });
    setTagInput('');
  }

  function removeTag(tag: string) {
    setInterestTags((current) =>
      current.filter((x) => x.toLowerCase() !== tag.toLowerCase()),
    );
  }

  function handleSave() {
    setError(null);
    setFeedback(null);

    const targetScores: UpdateStudentGoalsPayload['targetScores'] = {};
    if (satTarget.trim()) targetScores.SAT = satTarget.trim();
    if (ieltsTarget.trim()) targetScores.IELTS = ieltsTarget.trim();

    startTransition(async () => {
      const result = await updateStudentGoalsAction({
        targetScores,
        targetUniversityIds: selectedUniversityIds,
        interestTags,
      });
      if (!result.success) {
        setError(result.error ?? 'Kayıt başarısız.');
        return;
      }
      const hasScore = Object.keys(targetScores).length > 0;
      const hasUnis = selectedUniversityIds.length > 0;
      const hasTags = interestTags.length > 0;
      setContext((c) => ({
        ...c,
        targetScores,
        targetUniversityIds: selectedUniversityIds,
        interestTags,
        hasGoals: hasScore || hasUnis || hasTags,
      }));
      setFeedback('Hedeflerin ve rota kaydedildi; panel yenilendi.');
    });
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(56,189,248,0.12),transparent_60%)]"
      />
      <div className="relative mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Panele dön
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                🎯
              </span>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  Hedeflerim & Rota
                </h1>
                <p className="text-xs text-slate-500">
                  Meslek ilgileri, üniversite portföyü ve sınav hedeflerin.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-400/40 bg-gradient-to-r from-indigo-500/25 to-violet-500/20 px-5 py-2.5 text-sm font-medium text-indigo-50 shadow-inner shadow-indigo-500/10 transition hover:border-indigo-300/50 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Target className="size-4" />
            )}
            Değişiklikleri Kaydet & Rotayı Güncelle
          </button>
        </header>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <StudentHubNav currentHref="/student/goals" />

          <div className="min-w-0 flex-1 space-y-6">
            {error ? (
              <div
                role="alert"
                className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
              >
                {error}
              </div>
            ) : null}
            {feedback ? (
              <div
                role="status"
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
              >
                {feedback}
              </div>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <div className="flex items-center gap-2">
                <Tag className="size-4 text-amber-300" />
                <h2 className="text-sm font-medium text-slate-200">
                  Hedef meslekler & disiplinler
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                İlgi alanlarını etiket olarak ekle; dashboard ve öneriler bu
                bağlamı kullanır.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {PRESET_INTEREST_TAGS.map((tag) => {
                  const on = interestTags.some(
                    (t) => t.toLowerCase() === tag.toLowerCase(),
                  );
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        on ? removeTag(tag) : addTag(tag)
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        on
                          ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {interestTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs text-slate-200"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-white"
                      aria-label={`${tag} etiketini kaldır`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Özel etiket yaz…"
                  className="flex-1 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm outline-none transition focus:border-indigo-400/40"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.1]"
                >
                  Ekle
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-sky-300" />
                <h2 className="text-sm font-medium text-slate-200">
                  Hedef üniversite portföyü
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Havuzdan okul seç; minimum SAT ve IELTS barajları aşağıda
                gösterilir.
              </p>
              <label className="mt-4 block text-xs text-slate-500">
                Ara
                <input
                  type="search"
                  value={universityQuery}
                  onChange={(e) => setUniversityQuery(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-indigo-400/40"
                  placeholder="Ülke veya şehir…"
                />
              </label>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredUniversities.map((u) => {
                  const selected = selectedUniversityIds.includes(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => toggleUniversity(u.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          selected
                            ? 'border-indigo-400/45 bg-indigo-500/15 text-white'
                            : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/18 hover:text-slate-200'
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px] ${
                            selected
                              ? 'border-indigo-300 bg-indigo-500/40 text-white'
                              : 'border-white/20 text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-slate-100">
                            {u.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {u.city ? `${u.city}, ` : ''}
                            {u.country}
                            <span className="ml-2 text-slate-400">
                              · Min SAT: {u.minSatScore ?? '—'} · Min IELTS:{' '}
                              {u.minIeltsBand !== null
                                ? u.minIeltsBand.toFixed(1)
                                : '—'}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-violet-300" />
                <h2 className="text-sm font-medium text-slate-200">
                  Sınav skor çıtası
                </h2>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-slate-500">
                  Digital SAT hedefi (400–1600)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={400}
                    max={1600}
                    value={satTarget}
                    onChange={(e) => setSatTarget(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm tabular-nums outline-none transition focus:border-indigo-400/40"
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  IELTS hedef band (0–9)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ieltsTarget}
                    onChange={(e) => setIeltsTarget(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm tabular-nums outline-none transition focus:border-indigo-400/40"
                  />
                </label>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
