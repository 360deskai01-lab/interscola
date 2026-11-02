'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react';
import type { LibraryItem } from '@/app/teacher/library-actions';
import type { TeacherStudent } from '@/app/teacher/actions';
import { EXAM_MODES } from '@/lib/exam-shared';
import type { AssessmentPayload } from '@/types/exam';
import { LibraryExamPreviewModal } from '@/components/teacher/LibraryExamPreviewModal';

interface TeacherLibrarySectionProps {
  items: LibraryItem[];
  students: TeacherStudent[];
  onCreateLibrary: (input: {
    title: string;
    curriculum: string;
    extracted_text?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onAssignMaterial: (
    libraryId: string,
    studentId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onAssignGeneratedExam: (
    libraryId: string,
    studentId: string,
    examPayload: AssessmentPayload,
  ) => Promise<{ success: boolean; error?: string }>;
  onGenerateExamFromLibrary: (
    libraryId: string,
    questionCount: number,
  ) => Promise<{
    success: boolean;
    error?: string;
    exam?: AssessmentPayload;
  }>;
}

const CURRICULUM_OPTIONS = [
  { value: 'SAT', label: 'Digital SAT' },
  { value: 'IELTS', label: 'IELTS Academic' },
  { value: 'CAIE', label: 'CAIE A-Level' },
] as const;

const CURRICULUM_LABELS: Record<string, string> = {
  SAT: 'Digital SAT',
  IELTS: 'IELTS',
  CAIE: 'CAIE A-Level',
};

function curriculumLabel(code: string): string {
  return CURRICULUM_LABELS[code] ?? code;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function TeacherLibrarySection({
  items,
  students,
  onCreateLibrary,
  onAssignMaterial,
  onAssignGeneratedExam,
  onGenerateExamFromLibrary,
}: TeacherLibrarySectionProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [generatePending, startGenerateTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [curriculum, setCurriculum] = useState<string>('SAT');
  const [notes, setNotes] = useState('');
  const [assigningLibraryId, setAssigningLibraryId] = useState<string | null>(
    null,
  );
  const [generatingLibraryId, setGeneratingLibraryId] = useState<string | null>(
    null,
  );
  const [previewLibraryId, setPreviewLibraryId] = useState<string | null>(null);
  const [previewLibraryTitle, setPreviewLibraryTitle] = useState('');
  const [previewExam, setPreviewExam] = useState<AssessmentPayload | null>(null);

  function defaultQuestionCountForCurriculum(curriculum: string): number {
    const mode = EXAM_MODES.find((item) => item.curriculum === curriculum);
    return mode?.defaultQuestions ?? 2;
  }

  function handleGenerateExam(item: LibraryItem) {
    setError(null);
    setSuccess(null);

    const text = item.extractedText?.trim() ?? '';
    if (text.length < 40) {
      setError(
        'Sınav üretmek için materyalin "Not / Metin" alanına en az 40 karakter içerik ekleyin.',
      );
      return;
    }

    setGeneratingLibraryId(item.id);

    startGenerateTransition(async () => {
      const count = defaultQuestionCountForCurriculum(item.curriculum);
      const result = await onGenerateExamFromLibrary(item.id, count);
      setGeneratingLibraryId(null);

      if (!result.success || !result.exam) {
        setError(result.error ?? 'Sınav üretilemedi.');
        return;
      }

      setPreviewLibraryId(item.id);
      setPreviewLibraryTitle(item.title);
      setPreviewExam(result.exam);
    });
  }

  function closePreview() {
    setPreviewLibraryId(null);
    setPreviewLibraryTitle('');
    setPreviewExam(null);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await onCreateLibrary({
        title: title.trim(),
        curriculum,
        extracted_text: notes.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error ?? 'Materyal eklenemedi.');
        return;
      }

      setTitle('');
      setNotes('');
      setSuccess('Materyal kütüphanene eklendi.');
      router.refresh();
    });
  }

  function handleAssign(libraryId: string, studentId: string) {
    if (!studentId) {
      setError('Lütfen bir öğrenci seç.');
      return;
    }

    setError(null);
    setSuccess(null);
    setAssigningLibraryId(libraryId);

    startTransition(async () => {
      const result = await onAssignMaterial(libraryId, studentId);
      setAssigningLibraryId(null);

      if (!result.success) {
        setError(result.error ?? 'Atama yapılamadı.');
        return;
      }

      setSuccess('Materyal öğrenciye atandı.');
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
          <span className="leading-relaxed">{error}</span>
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <span className="leading-relaxed">{success}</span>
        </div>
      ) : null}

      <div className="rounded-3xl border border-violet-400/20 bg-violet-500/[0.06] p-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-violet-300" />
          <h2 className="text-sm font-medium text-slate-200">
            Yeni Materyal Ekle
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Not veya metin alanına ders özeti, okuma parçası veya ödev talimatını
          yazabilirsin.
        </p>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Başlık</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                minLength={2}
                placeholder="Örn. SAT Reading Passage 1"
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400/50 focus:ring-4 focus:ring-violet-500/10"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">
                Hedef Sınav
              </span>
              <select
                value={curriculum}
                onChange={(event) => setCurriculum(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-400/50 focus:ring-4 focus:ring-violet-500/10"
              >
                {CURRICULUM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-400">
              Not / Metin
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Öğrenciye iletilecek materyal metni veya ödev açıklaması…"
              className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400/50 focus:ring-4 focus:ring-violet-500/10"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BookOpen className="size-4" />
            )}
            Kütüphaneye Ekle
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-medium text-slate-200">
            Yüklü Materyaller ({items.length})
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <BookOpen className="mx-auto size-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-400">
              Henüz kütüphanede materyal yok.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-100">{item.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-200">
                      {curriculumLabel(item.curriculum)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  {item.extractedText ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {item.extractedText}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <button
                    type="button"
                    disabled={
                      generatePending && generatingLibraryId === item.id
                    }
                    onClick={() => handleGenerateExam(item)}
                    className="flex items-center gap-1.5 rounded-xl border-2 border-violet-400/60 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {generatePending && generatingLibraryId === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <span aria-hidden>✨</span>
                    )}
                    Bu Materyalden Sınav Üret
                  </button>

                  {students.length === 0 ? (
                    <span className="text-xs text-slate-600">
                      Atama için önce öğrenci bağla
                    </span>
                  ) : (
                    <>
                      <select
                        id={`assign-${item.id}`}
                        defaultValue=""
                        disabled={pending && assigningLibraryId === item.id}
                        className="min-w-[160px] rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-400/50"
                        aria-label={`${item.title} için öğrenci seç`}
                      >
                        <option value="" disabled>
                          Öğrenci seç…
                        </option>
                        {students.map((student) => (
                          <option key={student.studentId} value={student.studentId}>
                            {student.fullName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={pending && assigningLibraryId === item.id}
                        onClick={() => {
                          const select = document.getElementById(
                            `assign-${item.id}`,
                          ) as HTMLSelectElement | null;
                          const studentId = select?.value ?? '';
                          handleAssign(item.id, studentId);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-3.5 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
                      >
                        {pending && assigningLibraryId === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                        Çalışma Olarak Ata
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LibraryExamPreviewModal
        libraryId={previewLibraryId}
        libraryTitle={previewLibraryTitle}
        exam={previewExam}
        students={students}
        onClose={closePreview}
        onAssignGeneratedExam={onAssignGeneratedExam}
      />
    </div>
  );
}
