'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap, Loader2 } from 'lucide-react';
import type {
  AssessmentPayload,
  EvaluationResult,
  ExamQuestion,
} from '@/types/exam';
import { isRecord } from '@/lib/exam-shared';
import {
  clearExamSessionRecovery,
  readExamSessionRecovery,
  resolveExamSessionRecoveryTiming,
  writeExamSessionRecovery,
} from '@/lib/exam/exam-session-recovery';
import { resolveExamSessionDurationSeconds } from '@/lib/exam/exam-session-formats';
import { buildStudentAnswersPayload } from '@/lib/exam/student-answers-payload';
import { ExamResults } from '@/components/exam/ExamResults';
import { ExamRunner } from '@/components/exam/ExamRunner';
import { ErrorCard, GlowOrb } from '@/components/exam/ui';

type ExamPhase = 'exam' | 'grading' | 'results';

function extractApiError(payload: unknown, status: number): string {
  if (isRecord(payload) && typeof payload.error === 'string' && payload.error) {
    return payload.error;
  }
  return `Sunucu beklenmeyen bir yanıt döndürdü (${status}).`;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiError(payload, response.status));
  }
  return payload;
}

function pickEvaluation(payload: unknown): EvaluationResult {
  if (!isRecord(payload) || !isRecord(payload.evaluation)) {
    throw new Error('Değerlendirme alınamadı.');
  }
  return payload.evaluation as unknown as EvaluationResult;
}

interface StudentAssignmentExamClientProps {
  assignmentId: string;
  materialTitle: string;
  exam: AssessmentPayload;
  sessionLabel?: string;
  reviewHref?: string;
  isSelfPractice?: boolean;
  libraryId?: string | null;
  onStartSelfPacedExam?: (libraryId: string) => Promise<{
    success: boolean;
    error?: string;
    assignmentId?: string;
  }>;
  onCompleteAssignment: (
    assignmentId: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function StudentAssignmentExamClient({
  assignmentId,
  materialTitle,
  exam,
  sessionLabel = 'Eğitmen Sınavı',
  reviewHref,
  isSelfPractice = false,
  libraryId = null,
  onStartSelfPacedExam,
  onCompleteAssignment,
}: StudentAssignmentExamClientProps): ReactNode {
  const router = useRouter();
  const [retakePending, startRetakeTransition] = useTransition();
  const [phase, setPhase] = useState<ExamPhase>('exam');
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isTimerReady, setIsTimerReady] = useState(false);
  const [finishedFast, setFinishedFast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionWarning, setCompletionWarning] = useState<string | null>(
    null,
  );
  const [isFinishing, setIsFinishing] = useState(false);

  const deadlineRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const hasAutoSubmittedRef = useRef(false);
  const initializedRef = useRef(false);
  const isFinishingRef = useRef(false);

  const questions = exam.questions;
  const question: ExamQuestion | undefined = questions[currentIndex];
  const totalQuestions = questions.length;
  const progress =
    totalQuestions === 0 ? 0 : (currentIndex + 1) / totalQuestions;

  const requiresEveryAnswer = exam.engineType !== 'OBJECTIVE';

  const unansweredCount = useMemo(
    () =>
      exam.questions.filter((item) => !(answers[item.id] ?? '').trim()).length,
    [answers, exam.questions],
  );

  const answeredEvery = unansweredCount === 0;

  const lockExamTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    deadlineRef.current = null;
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const totalSeconds = resolveExamSessionDurationSeconds(exam);
    const recovered = readExamSessionRecovery(assignmentId);
    const maxIndex = Math.max(0, exam.questions.length - 1);
    const timing = resolveExamSessionRecoveryTiming(recovered, totalSeconds);

    if (recovered && !timing.trustRecoverySnapshot) {
      clearExamSessionRecovery(assignmentId);
    }

    if (recovered && timing.trustRecoverySnapshot) {
      setAnswers(recovered.answers);
      setCurrentIndex(Math.min(recovered.currentIndex, maxIndex));
      deadlineRef.current = timing.deadlineAt;
      setSecondsLeft(timing.sessionSeconds);
    } else {
      deadlineRef.current = timing.deadlineAt;
      setSecondsLeft(timing.sessionSeconds);
    }

    if (timing.sessionSeconds > 0) {
      setIsTimerReady(true);
    }
  }, [assignmentId, exam]);

  useEffect(() => {
    if (phase !== 'exam' || deadlineRef.current === null) return;
    writeExamSessionRecovery(assignmentId, {
      answers,
      currentIndex,
      deadlineAt: deadlineRef.current,
    });
  }, [answers, assignmentId, currentIndex, phase]);

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(Math.max(0, Math.min(totalQuestions - 1, index)));
    },
    [currentIndex, totalQuestions],
  );

  const handleRetake = useCallback(() => {
    if (isSelfPractice && libraryId && onStartSelfPacedExam) {
      startRetakeTransition(async () => {
        const result = await onStartSelfPacedExam(libraryId);
        if (result.success && result.assignmentId) {
          router.push(`/exam-session/${result.assignmentId}`);
          return;
        }
        router.push('/student/dashboard?tab=explore');
      });
      return;
    }

    clearExamSessionRecovery(assignmentId);
    setAnswers({});
    setCurrentIndex(0);
    setEvaluation(null);
    setCompletionWarning(null);
    hasAutoSubmittedRef.current = false;
    isFinishingRef.current = false;
    setIsFinishing(false);
    const totalSeconds = resolveExamSessionDurationSeconds(exam);
    deadlineRef.current = Date.now() + totalSeconds * 1000;
    setSecondsLeft(totalSeconds);
    setIsTimerReady(totalSeconds > 0);
    setPhase('exam');
  }, [
    assignmentId,
    exam,
    isSelfPractice,
    libraryId,
    onStartSelfPacedExam,
    router,
  ]);

  const finishExam = useCallback(async () => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    setIsFinishing(true);

    const secondsAtFinish = secondsLeft;
    const timedOutSubmit =
      secondsAtFinish <= 0 || hasAutoSubmittedRef.current;

    if (timedOutSubmit) {
      setSecondsLeft(0);
    }

    lockExamTimer();
    clearExamSessionRecovery(assignmentId);

    const totalSeconds = resolveExamSessionDurationSeconds(exam);
    setFinishedFast(
      !timedOutSubmit && secondsAtFinish > totalSeconds / 2,
    );

    setError(null);
    setPhase('grading');

    const gradeAttempts = 2;

    for (let attempt = 0; attempt < gradeAttempts; attempt += 1) {
      try {
        const studentAnswers = buildStudentAnswersPayload(exam, answers);
        const payload = await postJson('/api/grade-exam', {
          exam,
          studentAnswers,
          assignmentId,
        });
        const graded = pickEvaluation(payload);
        setError(null);
        setEvaluation({
          ...graded,
          is_timed_out: timedOutSubmit,
        });

        const completeResult = await onCompleteAssignment(assignmentId);
        if (!completeResult.success) {
          setCompletionWarning(
            completeResult.error ??
              'Karne hazır; ödev durumu panelde gecikmeli güncellenebilir.',
          );
        }

        setPhase('results');
        return;
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : 'Değerlendirme sırasında bir sorun oluştu.';

        if (attempt < gradeAttempts - 1) {
          setError(`${message} Yeniden deneniyor…`);
          continue;
        }

        setError(message);

        if (timedOutSubmit) {
          setSecondsLeft(0);
          setPhase('grading');
          return;
        }

        if (secondsAtFinish >= 60) {
          deadlineRef.current = Date.now() + secondsAtFinish * 1000;
          setSecondsLeft(secondsAtFinish);
          isFinishingRef.current = false;
          setIsFinishing(false);
          hasAutoSubmittedRef.current = false;
          setPhase('exam');
          return;
        }

        setSecondsLeft(0);
        setPhase('grading');
      }
    }
  }, [
    answers,
    assignmentId,
    exam,
    lockExamTimer,
    onCompleteAssignment,
    secondsLeft,
  ]);

  useEffect(() => {
    if (phase !== 'exam' || deadlineRef.current === null) return;

    const update = () => {
      if (deadlineRef.current === null) return;
      const remaining = Math.max(
        0,
        Math.round((deadlineRef.current - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };

    update();
    timerIntervalRef.current = window.setInterval(update, 1000);
    return () => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [phase]);

  useEffect(() => {
    if (!isTimerReady) return;
    if (phase !== 'exam') return;
    if (secondsLeft > 0) return;
    if (hasAutoSubmittedRef.current) return;

    hasAutoSubmittedRef.current = true;
    void finishExam();
  }, [finishExam, isTimerReady, phase, secondsLeft]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100">
      <GlowOrb className="size-[420px] bg-violet-600/35 -top-32 -left-24" delay={0} />
      <GlowOrb className="size-[380px] bg-fuchsia-600/25 top-1/3 -right-32" delay={2} />

      <AnimatePresence>
        {phase === 'exam' || phase === 'grading' ? (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-0 z-50 h-[3px] bg-white/5"
          >
            <motion.div
              className="relative h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="relative mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
              <GraduationCap className="size-6" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">
                {sessionLabel}
              </p>
              <p className="text-xs text-slate-500">{materialTitle}</p>
            </div>
          </div>
          <Link
            href="/student/dashboard"
            className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            ← Öğrenci Paneli
          </Link>
        </header>

        <AnimatePresence>
          {error ? (
            <ErrorCard message={error} onDismiss={() => setError(null)} />
          ) : null}
        </AnimatePresence>

        {completionWarning ? (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100"
          >
            {completionWarning}
          </div>
        ) : null}

        {phase === 'grading' ? (
          <div className="grid place-items-center py-24">
            <div className="flex flex-col items-center gap-5 text-center">
              {error ? (
                <p className="max-w-md text-sm text-rose-200">{error}</p>
              ) : (
                <>
                  <Loader2 className="size-10 animate-spin text-violet-300" />
                  <p className="text-lg font-semibold">
                    Yanıtların değerlendiriliyor
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}

        {phase === 'exam' && !isTimerReady ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="size-10 animate-spin text-violet-300" />
          </div>
        ) : null}

        {phase === 'exam' && isTimerReady && question ? (
          <ExamRunner
            exam={exam}
            question={question}
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            answers={answers}
            secondsLeft={secondsLeft}
            direction={direction}
            requiresEveryAnswer={requiresEveryAnswer}
            answeredEvery={answeredEvery}
            unansweredCount={unansweredCount}
            onAnswer={(questionId, answer) =>
              setAnswers((prev) => ({ ...prev, [questionId]: answer }))
            }
            onNavigate={goTo}
            onFinish={() => void finishExam()}
            finishDisabled={isFinishing}
            isGrading={isFinishing}
          />
        ) : null}

        {phase === 'results' && evaluation ? (
          <ExamResults
            exam={exam}
            evaluation={evaluation}
            finishedFast={finishedFast}
            answeredEvery={answeredEvery}
            isHistoryView={false}
            reviewHref={reviewHref}
            retryLabel={
              isSelfPractice
                ? retakePending
                  ? 'Yeni deneme hazırlanıyor…'
                  : 'Yeni Temiz Deneme Başlat'
                : undefined
            }
            onRetry={handleRetake}
            onHome={() => {
              window.location.href = isSelfPractice
                ? '/student/dashboard?tab=explore'
                : '/student/dashboard';
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
