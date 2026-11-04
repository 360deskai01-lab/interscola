'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ExamRunner } from '@/components/exam/ExamRunner';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(60, exam.durationMinutes * 60),
  );

  const totalQuestions = exam.questions.length;
  const question = exam.questions[currentIndex];
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const onAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  function onNavigate(index: number) {
    if (index < 0 || index >= totalQuestions) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }

  function onFinish() {
    const record = scoreGuestDiagnostic({ exam, answers, slug });
    writeGuestDiagnosticToStorage(record);
    router.push(`${testEtHref(slug)}/results`);
  }

  if (!question) {
    return null;
  }

  return (
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
    />
  );
}
