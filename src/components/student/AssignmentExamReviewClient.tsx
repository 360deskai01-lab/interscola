'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { GraduationCap } from 'lucide-react';
import type { AssessmentPayload, EvaluationResult } from '@/types/exam';
import { ExamResults } from '@/components/exam/ExamResults';

interface AssignmentExamReviewClientProps {
  materialTitle: string;
  exam: AssessmentPayload;
  evaluation: EvaluationResult;
  studentAnswers: Record<string, string>;
  isSelfPractice?: boolean;
  libraryId?: string | null;
  onStartSelfPacedExam?: (libraryId: string) => Promise<{
    success: boolean;
    error?: string;
    assignmentId?: string;
  }>;
}

export function AssignmentExamReviewClient({
  materialTitle,
  exam,
  evaluation,
  studentAnswers,
  isSelfPractice = false,
  libraryId = null,
  onStartSelfPacedExam,
}: AssignmentExamReviewClientProps): ReactNode {
  const router = useRouter();
  const [retakePending, startRetakeTransition] = useTransition();

  const objectiveQuestions =
    exam.engineType === 'OBJECTIVE' ? exam.questions : [];

  function handleRetake() {
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

    router.push('/student/dashboard');
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <main className="relative mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
              <GraduationCap className="size-6" />
            </span>
            <div>
              <p className="text-lg font-semibold">Karne & Yanlış Analizi</p>
              <p className="text-xs text-slate-500">{materialTitle}</p>
            </div>
          </div>
          <Link
            href={
              isSelfPractice
                ? '/student/dashboard?tab=explore'
                : '/student/dashboard'
            }
            className="rounded-md border border-white/10 px-3.5 py-1.5 text-sm text-slate-300 hover:text-white"
          >
            ← Öğrenci Paneli
          </Link>
        </header>

        <ExamResults
          exam={exam}
          evaluation={evaluation}
          finishedFast={false}
          answeredEvery
          isHistoryView
          retryLabel={
            isSelfPractice
              ? retakePending
                ? 'Yeni deneme hazırlanıyor…'
                : 'Yeni Temiz Deneme Başlat'
              : 'Panele Dön'
          }
          onRetry={handleRetake}
          onHome={() => {
            window.location.href = isSelfPractice
              ? '/student/dashboard?tab=explore'
              : '/student/dashboard';
          }}
        />

        {objectiveQuestions.length > 0 ? (
          <section className="mt-10 space-y-4">
            <h2 className="text-sm font-medium text-slate-200">
              Soru Bazlı Doğru / Yanlış
            </h2>
            {objectiveQuestions.map((question) => {
              const given = (studentAnswers[question.id] ?? '')
                .trim()
                .toUpperCase();
              const correct = (question.correctAnswer ?? '')
                .trim()
                .toUpperCase();
              const isCorrect = given !== '' && given === correct;

              return (
                <article
                  key={question.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <p className="text-xs font-medium text-violet-300 uppercase">
                    Soru {question.questionNumber}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-100">
                    {question.prompt}
                  </p>
                  <p
                    className={`mt-3 text-sm font-medium ${
                      isCorrect ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {isCorrect ? 'Doğru' : 'Yanlış / Eksik'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Senin cevabın: {given || '—'} · Doğru: {correct || '—'}
                  </p>
                  {question.explanation ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      {question.explanation}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : null}
      </main>
    </div>
  );
}
