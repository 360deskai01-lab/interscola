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

import { ExamRunner } from '@/components/exam/ExamRunner';
import { resolveExamSessionDurationSeconds } from '@/lib/exam/exam-session-formats';
import { scoreGuestDiagnostic } from '@/lib/test-et/guest-diagnostic-scoring';
import { writeGuestDiagnosticToStorage } from '@/lib/test-et/guest-diagnostic-storage';
import { testEtHref, type TestEtSlug } from '@/lib/test-et/test-et-config';
import type { AssessmentPayload } from '@/types/exam';

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    const record = scoreGuestDiagnostic({ exam, answers, slug });
    writeGuestDiagnosticToStorage(record);
    router.push(`${testEtHref(slug)}/results`);
  }, [answers, exam, router, slug]);

  useEffect(() => {
    if (secondsLeft > 0) return;
    if (hasAutoSubmittedRef.current) return;
    finishAndNavigate();
  }, [finishAndNavigate, secondsLeft]);

  const onAnswer = useCallback(
    (questionId: string, answer: string) => {
      if (secondsLeft <= 0 || isSubmitting) return;
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    },
    [isSubmitting, secondsLeft],
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
    finishAndNavigate();
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
        finishDisabled={isSubmitting || isTimeUp}
        isGrading={isSubmitting}
      />
    </>
  );
}
