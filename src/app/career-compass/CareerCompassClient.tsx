'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { Compass, Loader2, Lock, Sparkles } from 'lucide-react';
import {
  generateDeepCareerReportAction,
  getCareerCompassProgressAction,
  saveCareerAssessmentAction,
} from '@/app/career-compass/actions';
import {
  BIG_FIVE_DEEP_MODULE_READY,
  HOLLAND_DEEP_MODULE_READY,
  QUICK_RESULT_DEEPENING_INTRO,
} from '@/lib/career-assessment/deep-module-readiness';
import {
  CAREER_COMPASS_STAGE_ORDER,
  CAREER_STAGE_CTA,
  CAREER_STAGE_LABELS,
  computeCareerProgress,
  mapDbTypeToStage,
  type CareerCompassStageId,
} from '@/lib/career-assessment/progress';
import {
  DEEP_ASSESSMENT_META,
  getDeepQuestions,
} from '@/lib/assessment/deep-questions';
import { calculateScores } from '@/lib/assessment/scoring';
import { mergeAssessmentScoreMatrices } from '@/lib/career-assessment/merge-scores';
import { buildCareerInventoryTriad } from '@/lib/career-assessment/inventory-triad';
import { CareerHybridSynthesisCard } from '@/components/career/CareerHybridSynthesisCard';
import { CareerInventoryTriad } from '@/components/career/CareerInventoryTriad';
import { QUICK_COMBO_QUESTIONS } from '@/lib/assessment/questions';
import type {
  AssessmentAnswers,
  AssessmentKind,
  AssessmentQuestion,
  AssessmentScoreMatrix,
  LikertValue,
} from '@/types/assessment';

import {
  GUEST_QUICK_RESULT_STORAGE_KEY,
  GUEST_SESSION_STORAGE_KEY,
} from '@/lib/career-assessment/guest-session';

const LIKERT_LABELS: Record<LikertValue, string> = {
  1: 'Hiç bana göre değil',
  2: 'Az',
  3: 'Kısmen',
  4: 'Çoğunlukla',
  5: 'Tamamen beni anlatıyor',
};

type FlowPhase = 'intro' | 'quiz' | 'results';

interface CareerCompassClientProps {
  isLoggedIn: boolean;
}

function ensureGuestSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(GUEST_SESSION_STORAGE_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest-${Date.now()}`;
    window.localStorage.setItem(GUEST_SESSION_STORAGE_KEY, id);
  }
  return id;
}

function QuizCard({
  questions,
  title,
  onComplete,
}: {
  questions: AssessmentQuestion[];
  title: string;
  onComplete: (answers: AssessmentAnswers, scores: AssessmentScoreMatrix) => void;
}): ReactNode {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});

  const question = questions[index];
  const progress = questions.length
    ? Math.round(((index + 1) / questions.length) * 100)
    : 0;

  function pick(value: LikertValue) {
    if (!question) return;
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    if (index >= questions.length - 1) {
      onComplete(next, calculateScores(questions, next));
      return;
    }
    setIndex((current) => current + 1);
  }

  if (!question) return null;

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-xl">
      <p className="text-xs font-medium uppercase tracking-wide text-indigo-300">
        {title}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Soru {index + 1} / {questions.length}
      </p>
      <h2 className="mt-6 text-lg font-semibold leading-snug text-slate-50">
        {question.prompt}
      </h2>
      <div className="mt-6 space-y-2">
        {([1, 2, 3, 4, 5] as LikertValue[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => pick(value)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-indigo-400/40 hover:bg-indigo-500/10"
          >
            <span>{LIKERT_LABELS[value]}</span>
            <span className="tabular-nums text-indigo-300">{value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CompassProgressBar({
  progressPercent,
  completedCount,
  total,
}: {
  progressPercent: number;
  completedCount: number;
  total: number;
}): ReactNode {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>Kümülatif pusula ilerlemesi</span>
        <span className="tabular-nums text-indigo-200">
          {completedCount}/{total} · %{progressPercent}
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <ul className="mt-3 grid gap-1 text-[11px] text-slate-500 sm:grid-cols-3">
        {CAREER_COMPASS_STAGE_ORDER.map((stage, index) => (
          <li
            key={stage}
            className={
              index < completedCount ? 'text-emerald-300/90' : 'text-slate-500'
            }
          >
            {index < completedCount ? '✓ ' : `${index + 1}. `}
            {CAREER_STAGE_LABELS[stage].replace(/ \(.*\)/, '')}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeepeningModuleButton({
  label,
  ready,
  enabled,
  onClick,
}: {
  label: string;
  ready: boolean;
  enabled: boolean;
  onClick: () => void;
}): ReactNode {
  const active = ready && enabled;
  return (
    <button
      type="button"
      disabled={!active}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition ${
        active
          ? 'border-violet-400/40 bg-violet-500/15 text-violet-50 hover:bg-violet-500/25'
          : 'cursor-not-allowed border-white/10 bg-white/[0.02] text-slate-500 opacity-80'
      }`}
    >
      <span>{label}</span>
      {!active ? (
        <span className="shrink-0 rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
          Çok Yakında / Pro
        </span>
      ) : null}
    </button>
  );
}

function ResultsView({
  scores,
  isLoggedIn,
  resultSourceKind,
  progressPercent,
  completedCount,
  totalStages,
  completedStages,
  nextStage,
  onStartStage,
  onRestart,
}: {
  scores: AssessmentScoreMatrix;
  isLoggedIn: boolean;
  resultSourceKind: AssessmentKind | null;
  progressPercent: number;
  completedCount: number;
  totalStages: number;
  completedStages: Set<CareerCompassStageId>;
  nextStage: CareerCompassStageId | null;
  onStartStage: (kind: AssessmentKind) => void;
  onRestart: () => void;
}): ReactNode {
  const inventoryBundle = useMemo(
    () => buildCareerInventoryTriad(scores, completedStages),
    [scores, completedStages],
  );

  const nextCta =
    nextStage && isLoggedIn ? CAREER_STAGE_CTA[nextStage] : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {isLoggedIn ? (
        <CompassProgressBar
          progressPercent={progressPercent}
          completedCount={completedCount}
          total={totalStages}
        />
      ) : null}

      <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-6 text-center">
        <p className="text-sm text-indigo-200">Holland Kodunuz</p>
        <p className="mt-2 text-2xl font-bold text-slate-50">
          {scores.hollandTitle}
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:p-5">
        <CareerInventoryTriad cards={inventoryBundle.cards} />
        <CareerHybridSynthesisCard
          synthesis={inventoryBundle.synthesis}
          progressPercent={inventoryBundle.progressPercent}
          completedStageCount={inventoryBundle.completedStageCount}
          totalStages={inventoryBundle.totalStages}
        />
      </div>

      {resultSourceKind === 'quick_combo' ? (
        <section className="rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-slate-300">
            {QUICK_RESULT_DEEPENING_INTRO}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DeepeningModuleButton
              label="Holland Derin Mesleki İlgi Modülü"
              ready={HOLLAND_DEEP_MODULE_READY}
              enabled={isLoggedIn}
              onClick={() => onStartStage('deep_riasec')}
            />
            <DeepeningModuleButton
              label="Big Five Odak & Çalışma Stili Modülü"
              ready={BIG_FIVE_DEEP_MODULE_READY}
              enabled={isLoggedIn}
              onClick={() => onStartStage('deep_big_five')}
            />
          </div>
          {!isLoggedIn ? (
            <p className="mt-3 text-center text-xs text-slate-500">
              Derin modüller kayıtlı öğrenci hesabında açılır.{' '}
              <Link
                href="/auth/register?next=%2Fcareer-compass"
                className="text-indigo-300 underline"
              >
                Ücretsiz hesap oluştur
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border border-white/10">
        <div
          className={`space-y-4 p-6 ${isLoggedIn ? '' : 'select-none blur-sm'}`}
          aria-hidden={!isLoggedIn}
        >
          <h3 className="text-lg font-semibold text-slate-100">
            Detaylı çalışma stili & hedef üniversite eşleşmeleri
          </h3>
          <p className="text-sm leading-relaxed text-slate-400">
            Stres toleransınız: %{scores.bigFive.stress_tolerance.percent} · Odak:
            %{scores.bigFive.focus.percent} · Bocconi / Polimi / TU Munich baraj
            senaryolarına göre önerilen çalışma haftası ve sınav kombinasyonu…
          </p>
          <p className="text-sm leading-relaxed text-slate-400">
            Analitik güç %{scores.cognitive.analytical.percent} ile veri yoğun
            programlarda (Ekonomi, Mühendislik) planlı tekrar önerilir…
          </p>
        </div>
        {!isLoggedIn ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 p-6 text-center">
            <Lock className="size-8 text-indigo-300" />
            <p className="mt-3 max-w-sm text-sm text-slate-200">
              Detaylı rapor, stres profili ve hedef üniversite eşleşmeleri
              kayıtlı öğrencilere açılır.
            </p>
            <Link
              href="/auth/register?next=%2Fstudent%2Fdashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-indigo-400/50 bg-indigo-500/20 px-5 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
            >
              Kayıt Ol ve Raporun Kilidini Aç
            </Link>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-3">
        {nextCta ? (
          <button
            type="button"
            onClick={() => onStartStage(nextStage!)}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-400/50 bg-indigo-500/25 px-6 py-3 text-sm font-semibold text-indigo-50 transition hover:bg-indigo-500/35"
          >
            {nextCta.emoji} {nextCta.label}
          </button>
        ) : isLoggedIn && progressPercent >= 100 ? (
          <p className="text-sm text-emerald-300/90">
            Tebrikler — üç aşamalı pusula yolculuğunu tamamladınız.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onRestart}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-400 hover:bg-white/5"
        >
          Ana menüye dön
        </button>
      </div>
    </div>
  );
}

export default function CareerCompassClient({
  isLoggedIn,
}: CareerCompassClientProps): ReactNode {
  const [phase, setPhase] = useState<FlowPhase>('intro');
  const [scores, setScores] = useState<AssessmentScoreMatrix | null>(null);
  const [resultSourceKind, setResultSourceKind] = useState<AssessmentKind | null>(
    null,
  );
  const [deepKind, setDeepKind] = useState<AssessmentKind | null>(null);
  const [deepReport, setDeepReport] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completedStages, setCompletedStages] = useState<
    Set<CareerCompassStageId>
  >(() => new Set());

  const refreshProgress = useCallback(() => {
    if (!isLoggedIn) return;
    startTransition(async () => {
      const progress = await getCareerCompassProgressAction();
      if (progress.success && progress.completedStages) {
        setCompletedStages(new Set(progress.completedStages));
      }
    });
  }, [isLoggedIn]);

  useEffect(() => {
    refreshProgress();
  }, [refreshProgress]);

  const progressMeta = useMemo(
    () => computeCareerProgress(completedStages),
    [completedStages],
  );

  const markStageComplete = useCallback((kind: AssessmentKind) => {
    const stage = mapDbTypeToStage(kind);
    if (!stage) return;
    setCompletedStages((prev) => {
      const next = new Set(prev);
      next.add(stage);
      return next;
    });
  }, []);

  const persistResult = useCallback(
    (
      kind: AssessmentKind,
      answers: AssessmentAnswers,
      result: AssessmentScoreMatrix,
    ) => {
      markStageComplete(kind);
      const guestSessionId = isLoggedIn ? null : ensureGuestSessionId();
      if (!isLoggedIn) {
        window.localStorage.setItem(
          GUEST_QUICK_RESULT_STORAGE_KEY,
          JSON.stringify({ kind, answers, scores: result }),
        );
      }
      startTransition(async () => {
        const saved = await saveCareerAssessmentAction({
          kind,
          guestSessionId,
          answers,
          scores: result,
        });
        if (!saved.success) {
          setSaveError(saved.error ?? 'Kayıt başarısız.');
          return;
        }
        refreshProgress();
      });
    },
    [isLoggedIn, markStageComplete, refreshProgress],
  );

  const mergeWithExistingScores = useCallback(
    (previous: AssessmentScoreMatrix | null, incoming: AssessmentScoreMatrix) => {
      const list = previous ? [previous, incoming] : [incoming];
      return mergeAssessmentScoreMatrices(list) ?? incoming;
    },
    [],
  );

  const handleQuickComplete = useCallback(
    (answers: AssessmentAnswers, result: AssessmentScoreMatrix) => {
      setScores((prev) => mergeWithExistingScores(prev, result));
      setResultSourceKind('quick_combo');
      setPhase('results');
      persistResult('quick_combo', answers, result);
    },
    [mergeWithExistingScores, persistResult],
  );

  const handleDeepComplete = useCallback(
    (kind: AssessmentKind, answers: AssessmentAnswers, result: AssessmentScoreMatrix) => {
      let mergedForAi = result;
      setScores((prev) => {
        mergedForAi = mergeWithExistingScores(prev, result);
        return mergedForAi;
      });
      setResultSourceKind(kind);
      setDeepKind(null);
      setPhase('results');
      persistResult(kind, answers, result);
      if (isLoggedIn) {
        startTransition(async () => {
          const ai = await generateDeepCareerReportAction(mergedForAi);
          if (ai.success && ai.report) {
            setDeepReport(ai.report);
          }
        });
      }
    },
    [isLoggedIn, mergeWithExistingScores, persistResult],
  );

  useEffect(() => {
    if (isLoggedIn) return;
    try {
      const raw = window.localStorage.getItem(GUEST_QUICK_RESULT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        scores?: AssessmentScoreMatrix;
      };
      if (parsed.scores) {
        setScores(parsed.scores);
        setResultSourceKind('quick_combo');
        setPhase('results');
      }
    } catch {
      // yoksay
    }
  }, [isLoggedIn]);

  const activeQuestions =
    deepKind !== null ? getDeepQuestions(deepKind) : QUICK_COMBO_QUESTIONS;

  const quizTitle =
    deepKind !== null
      ? (DEEP_ASSESSMENT_META.find((m) => m.kind === deepKind)?.title ??
        'Derin test')
      : 'Hızlı Kombo Pusula (24 Soru)';

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-950 via-slate-950 to-indigo-950/40 px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200">
            <Compass className="size-3.5" />
            Kariyer Pusulası
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Hızlı Kombo Pusula
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            Üyeliksiz 24 soruluk ön profil · Kayıtlı öğrenciler için 3 derin
            analiz testi ve AI rehberlik raporu.
          </p>
        </header>

        {saveError ? (
          <p className="mb-4 text-center text-sm text-amber-200">{saveError}</p>
        ) : null}

        {isLoggedIn && phase !== 'quiz' ? (
          <div className="mb-8">
            <CompassProgressBar
              progressPercent={progressMeta.percent}
              completedCount={progressMeta.completedCount}
              total={progressMeta.total}
            />
          </div>
        ) : null}

        {phase === 'intro' && deepKind === null ? (
          <div className="space-y-8">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setPhase('quiz')}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-400/45 bg-indigo-500/20 px-6 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/30"
              >
                <Sparkles className="size-4" />
                24 Soruluk Hızlı Teste Başla
              </button>
            </div>

            {isLoggedIn ? (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-lg font-semibold text-slate-100">
                  Derin analiz modülleri
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tamamladığınızda Gemini destekli pedagojik rapor üretilir.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {DEEP_ASSESSMENT_META.map((meta) => (
                    <button
                      key={meta.kind}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setDeepKind(meta.kind);
                        setPhase('quiz');
                        setDeepReport(null);
                      }}
                      className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-4 text-left transition hover:bg-violet-500/20 disabled:opacity-50"
                    >
                      <p className="font-medium text-violet-100">{meta.title}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        {meta.description}
                      </p>
                    </button>
                  ))}
                </div>
                {deepReport ? (
                  <div className="mt-6 rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                    {deepReport}
                  </div>
                ) : null}
              </section>
            ) : (
              <p className="text-center text-sm text-slate-500">
                Derin RIASEC, Big Five ve Bilişsel testler için{' '}
                <Link
                  href="/auth/login?next=%2Fstudent%2Fdashboard"
                  className="text-indigo-300 underline"
                >
                  giriş yapın
                </Link>
                .
              </p>
            )}
          </div>
        ) : null}

        {phase === 'quiz' ? (
          <QuizCard
            key={deepKind ?? 'quick'}
            questions={activeQuestions}
            title={quizTitle}
            onComplete={(answers, result) => {
              if (deepKind !== null) {
                handleDeepComplete(deepKind, answers, result);
              } else {
                handleQuickComplete(answers, result);
              }
            }}
          />
        ) : null}

        {phase === 'results' && scores ? (
          <>
            <ResultsView
              scores={scores}
              isLoggedIn={isLoggedIn}
              resultSourceKind={resultSourceKind}
              progressPercent={progressMeta.percent}
              completedCount={progressMeta.completedCount}
              totalStages={progressMeta.total}
              completedStages={completedStages}
              nextStage={progressMeta.nextStage}
              onStartStage={(kind) => {
                setDeepKind(kind);
                setPhase('quiz');
                setDeepReport(null);
              }}
              onRestart={() => {
                setScores(null);
                setResultSourceKind(null);
                setPhase('intro');
                setDeepKind(null);
                setDeepReport(null);
              }}
            />
            {isLoggedIn && deepReport ? (
              <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-6">
                <h3 className="text-sm font-semibold text-cyan-100">
                  AI rehberlik raporu
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {deepReport}
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        {pending ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="size-3 animate-spin" /> Kaydediliyor…
          </p>
        ) : null}
      </div>
    </div>
  );
}
