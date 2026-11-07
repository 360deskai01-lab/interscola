'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Loader2 } from 'lucide-react';

import { ExamRunner } from '@/components/exam/ExamRunner';
import { ExamResultTimedOutBanner } from '@/components/exam/ExamResultCard';
import { resolveExamSessionDurationSeconds } from '@/lib/exam/exam-session-formats';
import { scoreGuestDiagnostic } from '@/lib/test-et/guest-diagnostic-scoring';
import { writeGuestDiagnosticToStorage } from '@/lib/test-et/guest-diagnostic-storage';
import { testEtHref, type TestEtSlug } from '@/lib/test-et/test-et-config';
import type { AssessmentPayload } from '@/types/exam';

type GuestSolvePhase = 'exam' | 'submitting';

interface GuestDiagnosticSolveClientProps {
  exam: AssessmentPayload;
  slug: TestEtSlug;
}

export function GuestDiagnosticSolveClient({
  exam,
  slug,
}: GuestDiagnosticSolveClientProps): ReactNode {
  const router = useRouter();
  const hasAutoSubmittedRef = useRef(false);
  const timedOutSubmitRef = useRef(false);
  const [phase, setPhase] = useState<GuestSolvePhase>('exam');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const officialDurationSeconds = useMemo(
    () => resolveExamSessionDurationSeconds(exam),
    [exam],
  );

  const [secondsLeft, setSecondsLeft] = useState(officialDurationSeconds);

  useEffect(() => {
    setSecondsLeft(officialDurationSeconds);
  }, [officialDurationSeconds]);

  const isTimeUp = secondsLeft <= 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const finishAndNavigate = useCallback(() => {
    if (hasAutoSubmittedRef.current) return;
    hasAutoSubmittedRef.current = true;
    setPhase('submitting');

    const record = scoreGuestDiagnostic({
      exam,
      answers,
      slug,
      is_timed_out: timedOutSubmitRef.current,
    });
    writeGuestDiagnosticToStorage(record);
    router.push(`${testEtHref(slug)}/results`);
  }, [answers, exam, router, slug]);

  useEffect(() => {
    if (secondsLeft > 0) return;
    if (hasAutoSubmittedRef.current) return;
    timedOutSubmitRef.current = true;
    finishAndNavigate();
  }, [finishAndNavigate, secondsLeft]);

  const onAnswer = useCallback(
    (questionId: string, answer: string) => {
      if (secondsLeft <= 0 || phase !== 'exam') return;
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    },
    [phase, secondsLeft],
  );

  const totalQuestions = exam.questions.length;
  const question = exam.questions[currentIndex];

  function onNavigate(index: number) {
    if (index < 0 || index >= totalQuestions) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }

  const requiresEveryAnswer =
    exam.engineType === 'LANGUAGE' || exam.engineType === 'RUBRIC_ESSAY';

  const answeredEvery = useMemo(
    () =>
      exam.questions.every(
        (item) => (answers[item.id] ?? '').trim().length > 0,
      ),
    [answers, exam.questions],
  );

  const unansweredCount = useMemo(
    () =>
      exam.questions.filter(
        (item) => (answers[item.id] ?? '').trim().length === 0,
      ).length,
    [answers, exam.questions],
  );

  function onFinish() {
    timedOutSubmitRef.current = secondsLeft <= 0;
    finishAndNavigate();
  }

  if (phase === 'submitting') {
    return (
      <div className="space-y-4 py-16">
        {timedOutSubmitRef.current ? <ExamResultTimedOutBanner /> : null}
        <div
          role="status"
          className="flex flex-col items-center gap-4 text-center"
        >
          <Loader2 className="size-10 animate-spin text-indigo-300" />
          <p className="text-sm font-medium text-slate-200">
            {timedOutSubmitRef.current
              ? 'Süreniz doldu — yanıtlarınız kaydediliyor ve puanınız hesaplanıyor…'
              : 'Yanıtlarınız kaydediliyor…'}
          </p>
        </div>
      </div>
    );
  }

  if (!question) {
    return null;
  }

  return (
    <>
      {isTimeUp ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-center text-sm font-medium text-rose-100"
        >
          ⏳ Süreniz Doldu! Yanıtlarınız kaydediliyor ve puanınız hesaplanıyor...
        </div>
      ) : null}
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
        onAnswer={onAnswer}
        onNavigate={onNavigate}
        onFinish={onFinish}
        finishLabel="Sınavı Tamamla & Puanımı Gör"
        finishDisabled={isTimeUp}
        isGrading={isTimeUp}
      />
    </>
  );
}
