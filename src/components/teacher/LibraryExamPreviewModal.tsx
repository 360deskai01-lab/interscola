'use client';

import { useState, useTransition, type ReactNode } from 'react';
import {
  AlertTriangle,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { AssessmentPayload, ExamQuestion } from '@/types/exam';
import type { TeacherStudent } from '@/app/teacher/actions';

interface LibraryExamPreviewModalProps {
  libraryId: string | null;
  libraryTitle: string;
  exam: AssessmentPayload | null;
  students: TeacherStudent[];
  onClose: () => void;
  onAssignGeneratedExam: (
    libraryId: string,
    studentId: string,
    examPayload: AssessmentPayload,
  ) => Promise<{ success: boolean; error?: string }>;
}

function rubricEntries(
  question: ExamQuestion,
): { label: string; value: string }[] {
  const rubric = question.rubricCriteria;
  if (!rubric) return [];

  const labels: Record<string, string> = {
    ao1_knowledge: 'AO1 — Bilgi',
    ao2_application: 'AO2 — Uygulama',
    ao3_evaluation: 'AO3 — Değerlendirme',
    ielts_task_achievement: 'Task Achievement',
    ielts_coherence_cohesion: 'Coherence & Cohesion',
    ielts_lexical_resource: 'Lexical Resource',
    ielts_grammatical_range: 'Grammatical Range',
  };

  return Object.entries(rubric)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key, value]) => ({
      label: labels[key] ?? key,
      value: value as string,
    }));
}

export function LibraryExamPreviewModal({
  libraryId,
  libraryTitle,
  exam,
  students,
  onClose,
  onAssignGeneratedExam,
}: LibraryExamPreviewModalProps): ReactNode {
  const [pending, startTransition] = useTransition();
  const [assignError, setAssignError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState('');

  if (!exam || !libraryId) return null;

  function handleAssign() {
    if (!libraryId || !exam) return;

    if (!studentId) {
      setAssignError('Lütfen bir öğrenci seç.');
      return;
    }

    setAssignError(null);
    startTransition(async () => {
      const result = await onAssignGeneratedExam(
        libraryId,
        studentId,
        exam,
      );
      if (!result.success) {
        setAssignError(result.error ?? 'Atama yapılamadı.');
        return;
      }
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-exam-preview-title"
    >
      <div className="flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30">
            <Sparkles className="size-5 text-violet-200" />
          </span>
          <div className="min-w-0 flex-1">
            <h3
              id="library-exam-preview-title"
              className="text-base font-semibold text-slate-100"
            >
              Sınav Önizleme
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {libraryTitle} · {exam.title}
            </p>
            <p className="mt-1 text-xs text-violet-200/90">
              {exam.curriculum} · {exam.engineType} · {exam.durationMinutes} dk ·{' '}
              {exam.totalMarks} puan · {exam.questions.length} soru
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {exam.questions.map((question) => {
            const rubric = rubricEntries(question);
            return (
              <article
                key={question.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-medium tracking-wide text-violet-300 uppercase">
                  Soru {question.questionNumber} · {question.targetMarks} puan
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
                  {question.prompt}
                </p>

                {question.options?.length ? (
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                    {question.options.map((option) => (
                      <li key={option} className="rounded-lg bg-slate-950/40 px-3 py-1.5">
                        {option}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {question.correctAnswer ? (
                  <p className="mt-2 text-xs text-emerald-300/90">
                    Doğru şık: {question.correctAnswer}
                  </p>
                ) : null}

                {rubric.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                    <p className="text-xs font-medium text-slate-400">
                      Resmî rubrik / mark scheme
                    </p>
                    {rubric.map((entry) => (
                      <div key={entry.label}>
                        <p className="text-[11px] font-medium text-slate-500">
                          {entry.label}
                        </p>
                        <p className="text-xs leading-relaxed text-slate-400">
                          {entry.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {question.explanation ? (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {question.explanation}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="space-y-3 border-t border-white/10 p-4">
          {assignError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-2.5 text-xs text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{assignError}</span>
            </div>
          ) : null}

          {students.length === 0 ? (
            <p className="text-xs text-slate-500">
              Atama için önce öğrenci bağlantısı kurmalısın.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                disabled={pending}
                className="min-w-[180px] flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-400/50"
                aria-label="Atanacak öğrenci"
              >
                <option value="">Öğrenci seç…</option>
                {students.map((student) => (
                  <option key={student.studentId} value={student.studentId}>
                    {student.fullName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssign}
                disabled={pending}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition enabled:hover:brightness-110 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Bu Sınavı Seçili Öğrenciye Ata
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
