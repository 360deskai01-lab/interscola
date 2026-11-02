'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { StudentCareerInsightForTeacher } from '@/lib/student-dashboard/teacher-career-insight';

export interface TeacherCareerInsightTarget {
  studentId: string;
  fullName: string;
}

interface TeacherStudentCareerInsightModalProps {
  target: TeacherCareerInsightTarget | null;
  onClose: () => void;
  onLoadInsight: (
    studentId: string,
    studentName: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: StudentCareerInsightForTeacher;
  }>;
}

export function TeacherStudentCareerInsightModal({
  target,
  onClose,
  onLoadInsight,
}: TeacherStudentCareerInsightModalProps): ReactNode {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<StudentCareerInsightForTeacher | null>(
    null,
  );
  const loadedForRef = useRef<string | null>(null);
  const onLoadRef = useRef(onLoadInsight);
  onLoadRef.current = onLoadInsight;

  useEffect(() => {
    if (!target) {
      loadedForRef.current = null;
      setInsight(null);
      setError(null);
      return;
    }

    if (loadedForRef.current === target.studentId) {
      return;
    }

    loadedForRef.current = target.studentId;
    setError(null);
    setInsight(null);

    const { studentId, fullName } = target;
    startTransition(async () => {
      const result = await onLoadRef.current(studentId, fullName);
      if (!result.success) {
        setError(result.error ?? 'Kariyer özeti yüklenemedi.');
        return;
      }
      setInsight(result.data ?? null);
    });
  }, [target]);

  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-career-insight-title"
    >
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(88vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-violet-400/25 bg-slate-950 shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-300">
              🎯 Yetkinlik & Kariyer Eğilimi
            </p>
            <h2
              id="teacher-career-insight-title"
              className="mt-1 text-lg font-semibold text-slate-50"
            >
              {target.fullName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {pending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
              <Loader2 className="size-5 animate-spin" />
              Yükleniyor…
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
            >
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {!pending && insight && !error ? (
            <div className="space-y-4">
              {!insight.hasAssessment ? (
                <p className="text-sm text-slate-400">
                  Öğrenci henüz Kariyer Pusulası envanterini tamamlamamış.
                  Atadığınız materyalleri genel hedef sınavlarına göre
                  planlayabilirsiniz.
                </p>
              ) : (
                <>
                  <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-4">
                    <p className="text-xs text-violet-200">Holland profili</p>
                    <p className="mt-1 font-semibold text-slate-50">
                      {insight.hollandCode} — {insight.hollandTitle}
                    </p>
                  </div>

                  {insight.topTraits.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Baskın ilgi & güçlü yönler
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {insight.topTraits.map((trait) => (
                          <span
                            key={trait}
                            className="rounded-full border border-indigo-400/30 bg-indigo-500/12 px-2.5 py-0.5 text-[11px] text-indigo-100"
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {insight.cognitiveHighlights.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Bilişsel vurgular
                      </p>
                      <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
                        {insight.cognitiveHighlights.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {insight.suggestedMajors.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Uyumlu alan örnekleri
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">
                        {insight.suggestedMajors.map((major) => (
                          <li key={major}>• {major}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {insight.aiInterpretation ? (
                    <p className="text-xs leading-relaxed text-slate-400">
                      {insight.aiInterpretation}
                    </p>
                  ) : null}
                </>
              )}

              <div>
                <p className="text-xs font-medium text-slate-500">
                  Hedeflenen üniversiteler
                </p>
                {insight.targetUniversities.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Pinlenmiş hedef okul yok.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {insight.targetUniversities.map((u) => (
                      <li
                        key={u.id}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                      >
                        {u.name}
                        <span className="ml-1 text-xs text-slate-500">
                          · {u.city ? `${u.city}, ` : ''}
                          {u.country}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
