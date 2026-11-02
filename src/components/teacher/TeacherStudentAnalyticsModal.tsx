'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { StudentAnalyticsData } from '@/lib/student-analytics';
import { StudentAnalyticsView } from '@/components/student/StudentAnalyticsView';

export interface TeacherAnalyticsStudentTarget {
  studentId: string;
  fullName: string;
}

interface TeacherStudentAnalyticsModalProps {
  target: TeacherAnalyticsStudentTarget | null;
  onClose: () => void;
  onLoadAnalytics: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: StudentAnalyticsData;
  }>;
}

export function TeacherStudentAnalyticsModal({
  target,
  onClose,
  onLoadAnalytics,
}: TeacherStudentAnalyticsModalProps): ReactNode {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<StudentAnalyticsData | null>(null);
  const loadedForRef = useRef<string | null>(null);
  const onLoadRef = useRef(onLoadAnalytics);
  onLoadRef.current = onLoadAnalytics;

  useEffect(() => {
    if (!target) {
      loadedForRef.current = null;
      setAnalytics(null);
      setError(null);
      return;
    }

    if (loadedForRef.current === target.studentId) {
      return;
    }

    loadedForRef.current = target.studentId;
    setError(null);
    setAnalytics(null);

    const studentId = target.studentId;
    startTransition(async () => {
      const result = await onLoadRef.current(studentId);
      if (!result.success) {
        setError(result.error ?? 'Analitik yüklenemedi.');
        return;
      }
      setAnalytics(
        result.data ?? { attempts: [], delta: null, learningGaps: [] },
      );
    });
  }, [target]);

  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-analytics-title"
    >
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(90vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-indigo-400/25 bg-slate-950 shadow-2xl shadow-indigo-950/50">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p
              id="teacher-analytics-title"
              className="text-sm font-semibold text-slate-100"
            >
              <span aria-hidden>📊</span> Gelişim & Analiz
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{target.fullName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {pending && !analytics ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="size-5 animate-spin text-cyan-400" />
              Deneme geçmişi yükleniyor…
            </div>
          ) : analytics ? (
            <StudentAnalyticsView
              analytics={analytics}
              emptyHint="Bu öğrencinin henüz kayıtlı bir sınav denemesi yok."
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
