'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import {
  ClipboardList,
  Loader2,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';
import type { ConversationMessage } from '@/app/messages/actions';
import {
  sendAssignmentOverdueReminderFormAction,
  type LibraryItem,
  type TeacherAssignmentProgressRow,
} from '@/app/teacher/library-actions';
import type {
  CreateTeacherAssignmentInput,
  TeacherAssignmentStudentOption,
} from '@/lib/b2b/teacher-assignment-actions';
import type { TeacherAssignmentReviewDetail } from '@/lib/b2b/teacher-assignment-review-types';
import { TeacherAssignmentReviewDrawer } from '@/components/teacher/TeacherAssignmentReviewDrawer';
import {
  TeacherAssignFromLibraryModal,
  type TeacherAssignSubmitResult,
} from '@/components/teacher/TeacherAssignFromLibraryModal';
import {
  MessageConversationModal,
  type MessageThreadTarget,
} from '@/components/messages/MessageConversationModal';

interface TeacherAssignmentsProgressSectionProps {
  rows: TeacherAssignmentProgressRow[];
  libraryItems: LibraryItem[];
  assignmentStudentPool: TeacherAssignmentStudentOption[];
  onCreateTeacherAssignment: (
    input: CreateTeacherAssignmentInput,
  ) => Promise<TeacherAssignSubmitResult>;
  onGetAssignmentReview: (assignmentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: TeacherAssignmentReviewDetail;
  }>;
  unreadByAssignment: Record<string, number>;
  onLoadConversation: (
    partnerId: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: ConversationMessage[];
  }>;
  onSendMessage: (
    receiverId: string,
    content: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onMarkMessagesRead: (
    senderId: string,
    assignmentId?: string,
    studentContextId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onOpenFacultyBoard?: (studentId: string, studentName: string) => void;
  onOpenWeeklyDigest?: (studentId: string, studentName: string) => void;
}

type StatusBucketFilter = 'all' | 'pending' | 'overdue' | 'completed';

function statusBadge(status: string): ReactNode {
  const pill =
    'inline-flex rounded-md border px-2.5 py-1 text-xs font-medium';
  if (status === 'in_progress') {
    return (
      <span
        className={`${pill} border-amber-400/40 bg-amber-500/20 text-amber-100`}
      >
        Devam Ediyor
      </span>
    );
  }

  if (status === 'completed') {
    return (
      <span
        className={`${pill} border-emerald-400/40 bg-emerald-500/20 text-emerald-100`}
      >
        Tamamlandı
      </span>
    );
  }

  return (
    <span
      className={`${pill} border-slate-500/40 bg-slate-500/20 text-slate-300`}
    >
      Başlanmadı
    </span>
  );
}

function examResultBadge(
  result: TeacherAssignmentProgressRow['examResult'],
): ReactNode {
  if (!result) {
    return <span className="text-slate-600">—</span>;
  }

  const pct = Math.round(result.percentage);

  return (
    <span className="inline-flex max-w-[220px] flex-wrap items-center gap-1 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-100">
      <span aria-hidden>🎯</span>
      <span className="truncate">{result.scaledResult}</span>
      <span className="text-emerald-200/80">(%{pct})</span>
    </span>
  );
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

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isOverdueRow(row: TeacherAssignmentProgressRow, now: number): boolean {
  if (row.status === 'completed') return false;
  if (!row.dueDate) return false;
  const t = new Date(row.dueDate).getTime();
  if (Number.isNaN(t)) return false;
  return t < now;
}

const FILTER_PILLS: { id: StatusBucketFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Bekleyenler' },
  { id: 'overdue', label: 'Gecikenler' },
  { id: 'completed', label: 'Tamamlananlar' },
];

export function TeacherAssignmentsProgressSection({
  rows,
  libraryItems,
  assignmentStudentPool,
  onCreateTeacherAssignment,
  onGetAssignmentReview,
  unreadByAssignment,
  onLoadConversation,
  onSendMessage,
  onMarkMessagesRead,
  onOpenFacultyBoard,
  onOpenWeeklyDigest,
}: TeacherAssignmentsProgressSectionProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [remindPending, startRemind] = useTransition();
  const [messageTarget, setMessageTarget] =
    useState<MessageThreadTarget | null>(null);
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] =
    useState<StatusBucketFilter>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reviewPending, startReviewTransition] = useTransition();
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [reviewDetail, setReviewDetail] =
    useState<TeacherAssignmentReviewDetail | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const studentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (!map.has(row.studentId)) {
        map.set(row.studentId, row.studentFullName);
      }
    }
    return [...map.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], 'tr'),
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const now = Date.now();
    return rows.filter((row) => {
      if (studentFilter && row.studentId !== studentFilter) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'completed') return row.status === 'completed';
      const overdue = isOverdueRow(row, now);
      if (statusFilter === 'overdue') return overdue;
      if (statusFilter === 'pending') {
        return row.status !== 'completed' && !overdue;
      }
      return true;
    });
  }, [rows, studentFilter, statusFilter]);

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  function openAssignmentReview(row: TeacherAssignmentProgressRow) {
    if (row.status !== 'completed') return;
    setReviewDrawerOpen(true);
    setReviewDetail(null);
    setReviewError(null);
    setReviewLoadingId(row.assignmentId);
    startReviewTransition(async () => {
      const result = await onGetAssignmentReview(row.assignmentId);
      setReviewLoadingId(null);
      if (!result.success || !result.data) {
        setReviewError(result.error ?? 'Karne detayı yüklenemedi.');
        return;
      }
      setReviewDetail(result.data);
    });
  }

  function handleRemind(row: TeacherAssignmentProgressRow) {
    setToast(null);
    setRemindingId(row.assignmentId);
    startRemind(async () => {
      const result = await sendAssignmentOverdueReminderFormAction(
        row.assignmentId,
        row.materialTitle,
      );
      setRemindingId(null);
      if (!result.success) {
        setToast(result.error ?? 'Hatırlatma gönderilemedi.');
        return;
      }
      setToast('Hatırlatma mesajı öğrenciye gönderildi.');
      router.refresh();
    });
  }

  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-200">
            Ödev & Deneme Takibi
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Öğrencilerinin atanan materyal ve denemelerdeki anlık durumları.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAssignModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-400/35 bg-indigo-500/15 px-3.5 py-2 text-xs font-medium text-indigo-100 transition hover:bg-indigo-500/25"
          >
            <span aria-hidden>➕</span>
            Kütüphaneden yeni ödev ata
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Listeyi Yenile
          </button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <label className="block min-w-[200px] flex-1 text-xs text-slate-500">
            Öğrenci
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-400/45"
            >
              <option value="">Tüm öğrenciler</option>
              {studentOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Durum</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FILTER_PILLS.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                    statusFilter === pill.id
                      ? 'border-indigo-400/50 bg-indigo-500/25 text-indigo-50'
                      : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
            {studentFilter &&
            (onOpenFacultyBoard || onOpenWeeklyDigest) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {onOpenFacultyBoard ? (
                  <button
                    type="button"
                    onClick={() => {
                      const name =
                        studentOptions.find(([id]) => id === studentFilter)?.[1] ??
                        'Öğrenci';
                      onOpenFacultyBoard(studentFilter, name);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/35 bg-fuchsia-500/12 px-2.5 py-1 text-[11px] font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/22"
                  >
                    <span aria-hidden>🎓</span>
                    Ortak Eğitmenler
                  </button>
                ) : null}
                {onOpenWeeklyDigest ? (
                  <button
                    type="button"
                    onClick={() => {
                      const name =
                        studentOptions.find(([id]) => id === studentFilter)?.[1] ??
                        'Öğrenci';
                      onOpenWeeklyDigest(studentFilter, name);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/22"
                  >
                    <span aria-hidden>📝</span>
                    Haftalık Değerlendirme
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100"
        >
          {toast}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ClipboardList className="mx-auto size-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-400">
              Henüz atanmış ödev kaydı yok.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Üstteki «Kütüphaneden yeni ödev ata» ile veya kütüphane sekmesinden
              atama yaptığında burada görünür.
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            Bu filtrelere uyan kayıt yok.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-6">Öğrenci</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Materyal</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Atama Tarihi</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Son Teslim</th>
                  <th className="px-4 py-3 font-medium sm:px-6">Durum</th>
                  <th className="px-4 py-3 font-medium sm:px-6">
                    Sınav Notu / Sonuç
                  </th>
                  <th className="min-w-[120px] whitespace-nowrap px-4 py-3 text-right font-medium sm:px-6">
                    İncele
                  </th>
                  <th className="min-w-[110px] pr-4 pl-4 text-right font-medium sm:px-6">
                    İletişim
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRows.map((row) => {
                  const overdue =
                    row.status !== 'completed' &&
                    isOverdueRow(row, now);
                  const showRemind =
                    overdue && row.dueDate != null;

                  return (
                    <tr
                      key={row.assignmentId}
                      className="transition hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-4 font-medium text-slate-100 sm:px-6">
                        {row.studentFullName}
                      </td>
                      <td className="px-4 py-4 sm:px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-slate-200">{row.materialTitle}</p>
                          {overdue ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/45 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-100">
                              <span aria-hidden>⏱️</span>
                              Gecikti
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.curriculum}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-400 sm:px-6">
                        {formatDate(row.assignedAt)}
                      </td>
                      <td className="px-4 py-4 text-slate-400 sm:px-6">
                        {row.dueDate ? formatDateTime(row.dueDate) : '—'}
                      </td>
                      <td className="px-4 py-4 sm:px-6">
                        {statusBadge(row.status)}
                      </td>
                      <td className="px-4 py-4 sm:px-6">
                        {examResultBadge(row.examResult)}
                      </td>
                      <td className="min-w-[120px] whitespace-nowrap px-4 py-4 text-right sm:px-6">
                        {row.status === 'completed' ? (
                          <button
                            type="button"
                            onClick={() => openAssignmentReview(row)}
                            disabled={
                              reviewPending &&
                              reviewLoadingId === row.assignmentId
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-50 transition hover:bg-indigo-500/30 disabled:opacity-50"
                          >
                            {reviewPending &&
                            reviewLoadingId === row.assignmentId ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <span aria-hidden>📊</span>
                            )}
                            İncele / sonuç
                          </button>
                        ) : (
                          <span className="inline-flex rounded-md border border-slate-600/40 bg-slate-800/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">
                            Bekleniyor
                          </span>
                        )}
                      </td>
                      <td className="min-w-[110px] px-4 py-4 pr-4 text-right sm:px-6 sm:pr-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {showRemind ? (
                            <button
                              type="button"
                              onClick={() => handleRemind(row)}
                              disabled={remindPending && remindingId === row.assignmentId}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/12 px-2.5 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/22 disabled:opacity-50"
                            >
                              {remindPending && remindingId === row.assignmentId ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <span aria-hidden>🔔</span>
                              )}
                              Hatırlat
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setMessageTarget({
                                partnerId: row.studentId,
                                partnerLabel: row.studentFullName,
                                assignmentId: row.assignmentId,
                                contextLabel: row.materialTitle,
                              })
                            }
                            className="relative inline-flex items-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:bg-violet-500/20"
                          >
                            <MessageCircle className="size-3.5" />
                            Mesajlar
                            <UnreadMessageBadge
                              count={
                                unreadByAssignment[row.assignmentId] ?? 0
                              }
                              className="absolute -top-1.5 -right-1.5"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MessageConversationModal
        target={messageTarget}
        onClose={() => {
          setMessageTarget(null);
          router.refresh();
        }}
        onLoadConversation={onLoadConversation}
        onSendMessage={onSendMessage}
        onMarkRead={onMarkMessagesRead}
      />

      <TeacherAssignmentReviewDrawer
        open={reviewDrawerOpen}
        loading={reviewPending}
        error={reviewError}
        detail={reviewDetail}
        onClose={() => {
          setReviewDrawerOpen(false);
          setReviewDetail(null);
          setReviewError(null);
          setReviewLoadingId(null);
        }}
      />

      <TeacherAssignFromLibraryModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        libraryItems={libraryItems}
        studentPool={assignmentStudentPool}
        onSubmit={onCreateTeacherAssignment}
        onSuccess={(result: TeacherAssignSubmitResult) => {
          const skipped = result.skippedCount ?? 0;
          const count = result.count ?? 0;
          if (skipped > 0) {
            setToast(
              `✅ ${count} öğrenciye atandı. ⚠️ ${skipped} öğrenci zaten bu göreve sahip olduğu için atlandı.`,
            );
          } else {
            setToast(`✅ ${count} öğrenciye başarıyla atandı.`);
          }
          router.refresh();
        }}
      />
    </div>
  );
}
