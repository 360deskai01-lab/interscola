'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type {
  LibraryItem,
  LibraryAssignmentHistoryRow,
  TeacherAssignmentProgressRow,
} from '@/app/teacher/library-actions';
import type { TeacherStudent } from '@/app/teacher/actions';
import { EXAM_MODES } from '@/lib/exam-shared';
import type { AssessmentPayload } from '@/types/exam';
import { LibraryExamPreviewModal } from '@/components/teacher/LibraryExamPreviewModal';
import { LibraryExamHistoryModal } from '@/components/teacher/LibraryExamHistoryModal';

interface TeacherLibrarySectionProps {
  items: LibraryItem[];
  students: TeacherStudent[];
  assignmentProgress: TeacherAssignmentProgressRow[];
  onCreateLibrary: (input: {
    title: string;
    curriculum: string;
    extracted_text?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onAssignMaterial: (
    libraryId: string,
    studentId: string,
    dueDate?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  onAssignGeneratedExam: (
    libraryId: string,
    studentId: string,
    examPayload: AssessmentPayload,
    dueDate?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  onGenerateExamFromLibrary: (
    libraryId: string,
    questionCount: number,
  ) => Promise<{
    success: boolean;
    error?: string;
    exam?: AssessmentPayload;
  }>;
  onLoadLibraryAssignmentHistory: (libraryId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: LibraryAssignmentHistoryRow[];
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

const ACTIVE_STATUSES = new Set(['assigned', 'in_progress']);

function studentIdsBlockedForLibrary(
  libraryId: string,
  assignmentType: 'study' | 'exam',
  progress: TeacherAssignmentProgressRow[],
): Set<string> {
  const blocked = new Set<string>();
  for (const row of progress) {
    if (row.libraryId !== libraryId) continue;
    if (row.assignmentType !== assignmentType) continue;
    if (!ACTIVE_STATUSES.has(String(row.status))) continue;
    blocked.add(row.studentId);
  }
  return blocked;
}

export function TeacherLibrarySection({
  items,
  students,
  assignmentProgress,
  onCreateLibrary,
  onAssignMaterial,
  onAssignGeneratedExam,
  onGenerateExamFromLibrary,
  onLoadLibraryAssignmentHistory,
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
  const [historyLibraryId, setHistoryLibraryId] = useState<string | null>(null);
  const [historyLibraryTitle, setHistoryLibraryTitle] = useState('');
  const [assignDrafts, setAssignDrafts] = useState<
    Record<string, { studentId: string; dueLocal: string }>
  >({});

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

  function openHistory(item: LibraryItem) {
    setHistoryLibraryId(item.id);
    setHistoryLibraryTitle(item.title);
  }

  function closeHistory() {
    setHistoryLibraryId(null);
    setHistoryLibraryTitle('');
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

  function dueLocalToIsoOrNull(dueLocal: string): string | null {
    const t = dueLocal.trim();
    if (!t) return null;
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function handleAssign(libraryId: string, studentId: string, dueLocal: string) {
    if (!studentId) {
      setError('Lütfen bir öğrenci seç.');
      return;
    }

    setError(null);
    setSuccess(null);
    setAssigningLibraryId(libraryId);

    startTransition(async () => {
      const result = await onAssignMaterial(
        libraryId,
        studentId,
        dueLocalToIsoOrNull(dueLocal),
      );
      setAssigningLibraryId(null);

      if (!result.success) {
        setError(result.error ?? 'Atama yapılamadı.');
        return;
      }

      setSuccess('Materyal öğrenciye atandı.');
      setAssignDrafts((current) => ({
        ...current,
        [libraryId]: { studentId: '', dueLocal: '' },
      }));
      router.refresh();
    });
  }

  function patchAssignDraft(
    libraryId: string,
    patch: Partial<{ studentId: string; dueLocal: string }>,
  ) {
    setAssignDrafts((current) => ({
      ...current,
      [libraryId]: {
        studentId:
          patch.studentId ?? current[libraryId]?.studentId ?? '',
        dueLocal: patch.dueLocal ?? current[libraryId]?.dueLocal ?? '',
      },
    }));
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
            {items.map((item) => {
              const blockedStudyIds = studentIdsBlockedForLibrary(
                item.id,
                'study',
                assignmentProgress,
              );
              return (
              <li key={item.id} className="flex flex-col">
                <div className="w-full px-6 pt-4 pb-3">
                  <h3 className="w-full break-words text-[15px] font-semibold leading-snug text-slate-100">
                    {item.title}
                  </h3>
                  <div className="mt-2.5 flex min-h-[1.5rem] flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    <span className="inline-flex items-center rounded-md border border-violet-400/35 bg-violet-500/12 px-2 py-0.5 font-medium text-violet-200">
                      {curriculumLabel(item.curriculum)}
                    </span>
                    <span className="inline-flex items-center text-slate-500">
                      {formatDate(item.createdAt)}
                    </span>
                    {item.extractedText ? (
                      <span className="line-clamp-1 min-w-0 max-w-full flex-1 basis-[min(100%,12rem)] text-slate-500">
                        {item.extractedText.trim()}
                      </span>
                    ) : (
                      <span className="text-slate-600">Özet yok</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-white/5 px-6 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3 lg:max-w-md">
                      {students.length === 0 ? (
                        <p className="text-xs text-slate-600">
                          Atama için önce öğrenci bağla
                        </p>
                      ) : (
                        <>
                          <select
                            value={assignDrafts[item.id]?.studentId ?? ''}
                            onChange={(e) =>
                              patchAssignDraft(item.id, {
                                studentId: e.target.value,
                              })
                            }
                            disabled={pending && assigningLibraryId === item.id}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-400/50 sm:w-64"
                            aria-label={`${item.title} için öğrenci seç`}
                          >
                            <option value="" disabled>
                              Öğrenci seç…
                            </option>
                            {students.map((student) => (
                              <option
                                key={student.studentId}
                                value={student.studentId}
                                disabled={blockedStudyIds.has(
                                  student.studentId,
                                )}
                              >
                                {student.fullName}
                                {blockedStudyIds.has(student.studentId)
                                  ? ' (Zaten Atandı)'
                                  : ''}
                              </option>
                            ))}
                          </select>
                          <label className="block text-[11px] font-medium text-slate-500">
                            Son Teslim Tarihi ve Saati (opsiyonel)
                            <span className="relative mt-1.5 block">
                              <Calendar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                              <input
                                type="datetime-local"
                                value={assignDrafts[item.id]?.dueLocal ?? ''}
                                onChange={(e) =>
                                  patchAssignDraft(item.id, {
                                    dueLocal: e.target.value,
                                  })
                                }
                                disabled={
                                  pending && assigningLibraryId === item.id
                                }
                                className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-2.5 pr-3 pl-10 text-sm text-slate-100 outline-none focus:border-indigo-400/45 [color-scheme:dark]"
                              />
                            </span>
                          </label>
                        </>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                      <button
                        type="button"
                        onClick={() => openHistory(item)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-xs font-medium text-slate-200 transition hover:border-white/25 hover:bg-white/[0.07]"
                      >
                        <span aria-hidden>👥</span>
                        Atama Geçmişi
                      </button>
                      <button
                        type="button"
                        disabled={
                          generatePending && generatingLibraryId === item.id
                        }
                        onClick={() => handleGenerateExam(item)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-violet-400/60 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:opacity-60"
                      >
                        {generatePending && generatingLibraryId === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <span aria-hidden>✨</span>
                        )}
                        Bu Materyalden Sınav Üret
                      </button>
                      {students.length > 0 ? (
                        <button
                          type="button"
                          disabled={pending && assigningLibraryId === item.id}
                          onClick={() => {
                            const draft = assignDrafts[item.id];
                            handleAssign(
                              item.id,
                              draft?.studentId ?? '',
                              draft?.dueLocal ?? '',
                            );
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-3.5 py-2.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
                        >
                          {pending && assigningLibraryId === item.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <span aria-hidden>🚀</span>
                          )}
                          Çalışma Olarak Ata
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </div>

      <LibraryExamPreviewModal
        libraryId={previewLibraryId}
        libraryTitle={previewLibraryTitle}
        exam={previewExam}
        students={students}
        blockedStudentIds={
          previewLibraryId
            ? [...studentIdsBlockedForLibrary(
                previewLibraryId,
                'exam',
                assignmentProgress,
              )]
            : []
        }
        onClose={closePreview}
        onAssignGeneratedExam={onAssignGeneratedExam}
      />

      <LibraryExamHistoryModal
        libraryId={historyLibraryId}
        libraryTitle={historyLibraryTitle}
        onClose={closeHistory}
        onLoadHistory={onLoadLibraryAssignmentHistory}
      />
    </div>
  );
}
