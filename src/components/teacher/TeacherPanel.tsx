'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardList,
  Copy,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import type {
  TeacherInvite,
  TeacherOrganizationContext,
  TeacherStudent,
} from '@/app/teacher/actions';
import type { ConversationMessage } from '@/app/messages/actions';
import type { AssessmentPayload } from '@/types/exam';
import type {
  LibraryItem,
  TeacherAssignmentProgressRow,
} from '@/app/teacher/library-actions';
import {
  MessageConversationModal,
  type MessageThreadTarget,
} from '@/components/messages/MessageConversationModal';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';
import { unreadGeneralScopeKey } from '@/lib/message-unread-scopes';
import type { StudentAnalyticsData } from '@/lib/student-analytics';
import { TeacherAssignmentsProgressSection } from '@/components/teacher/TeacherAssignmentsProgressSection';
import { TeacherLibrarySection } from '@/components/teacher/TeacherLibrarySection';
import {
  TeacherStudentAnalyticsModal,
  type TeacherAnalyticsStudentTarget,
} from '@/components/teacher/TeacherStudentAnalyticsModal';
import {
  TeacherStudentCareerInsightModal,
  type TeacherCareerInsightTarget,
} from '@/components/teacher/TeacherStudentCareerInsightModal';
import type { StudentCareerInsightForTeacher } from '@/lib/student-dashboard/teacher-career-insight';

type PanelTab = 'students' | 'library' | 'progress';

interface TeacherPanelProps {
  students: TeacherStudent[];
  invites: TeacherInvite[];
  libraryItems: LibraryItem[];
  assignmentProgress: TeacherAssignmentProgressRow[];
  orgContext: TeacherOrganizationContext | null;
  onCreateInvite: () => Promise<{ success: boolean; error?: string; inviteCode?: string }>;
  onRemoveStudent: (linkId: string) => Promise<{ success: boolean; error?: string }>;
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
  onLoadConversation: (
    partnerId: string,
    assignmentId?: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: ConversationMessage[];
  }>;
  onSendMessage: (
    receiverId: string,
    content: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onMarkMessagesRead: (
    senderId: string,
    assignmentId?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  unreadByAssignment: Record<string, number>;
  onLoadStudentAnalytics: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: StudentAnalyticsData;
  }>;
  onLoadStudentCareerInsight: (
    studentId: string,
    studentName: string,
  ) => Promise<{
    success: boolean;
    error?: string;
    data?: StudentCareerInsightForTeacher;
  }>;
}

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

/** Öğretmen panelinin etkileşimli kısmı. */
export function TeacherPanel({
  students,
  invites,
  libraryItems,
  assignmentProgress,
  orgContext,
  onCreateInvite,
  onRemoveStudent,
  onCreateLibrary,
  onAssignMaterial,
  onAssignGeneratedExam,
  onGenerateExamFromLibrary,
  onLoadConversation,
  onSendMessage,
  onMarkMessagesRead,
  unreadByAssignment,
  onLoadStudentAnalytics,
  onLoadStudentCareerInsight,
}: TeacherPanelProps): ReactNode {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PanelTab>('students');
  const [studentMessageTarget, setStudentMessageTarget] =
    useState<MessageThreadTarget | null>(null);
  const [analyticsTarget, setAnalyticsTarget] =
    useState<TeacherAnalyticsStudentTarget | null>(null);
  const [careerInsightTarget, setCareerInsightTarget] =
    useState<TeacherCareerInsightTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [freshCode, setFreshCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleCreateInvite() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await onCreateInvite();
      if (!result.success) {
        setError(result.error ?? 'Davet kodu oluşturulamadı.');
        return;
      }
      setFreshCode(result.inviteCode ?? null);
    });
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa kullanıcı kodu elle seçebilir.
      setCopied(false);
    }
  }

  function handleRemove(linkId: string) {
    setError(null);
    setRemovingId(linkId);
    startTransition(async () => {
      const result = await onRemoveStudent(linkId);
      if (!result.success) {
        setError(result.error ?? 'Bağlantı koparılamadı.');
      }
      setRemovingId(null);
    });
  }

  return (
    <div className="space-y-6">
      {orgContext ? (
        <p className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100">
          <span aria-hidden>🏛️</span>
          {orgContext.organizationName}
          {orgContext.branchName ? ` — ${orgContext.branchName}` : ''}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            activeTab === 'students'
              ? 'bg-gradient-to-r from-indigo-500/25 to-fuchsia-500/20 text-white shadow-inner'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserRound className="size-4" />
          Öğrenciler & Davet
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            activeTab === 'library'
              ? 'bg-gradient-to-r from-violet-500/25 to-fuchsia-500/20 text-white shadow-inner'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="size-4" />
          Ders Materyallerim & Kütüphane
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('progress')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            activeTab === 'progress'
              ? 'bg-gradient-to-r from-amber-500/20 to-emerald-500/15 text-white shadow-inner'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="size-4" />
          Ödev & İlerleme Takibi
        </button>
      </div>

      {activeTab === 'progress' ? (
        <TeacherAssignmentsProgressSection
          rows={assignmentProgress}
          unreadByAssignment={unreadByAssignment}
          onLoadConversation={onLoadConversation}
          onSendMessage={onSendMessage}
          onMarkMessagesRead={onMarkMessagesRead}
        />
      ) : null}

      {activeTab === 'library' ? (
        <TeacherLibrarySection
          items={libraryItems}
          students={students}
          onCreateLibrary={onCreateLibrary}
          onAssignMaterial={onAssignMaterial}
          onAssignGeneratedExam={onAssignGeneratedExam}
          onGenerateExamFromLibrary={onGenerateExamFromLibrary}
        />
      ) : null}

      {activeTab === 'students' && error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
          <span className="leading-relaxed">{error}</span>
        </div>
      ) : null}

      {activeTab !== 'students' ? null : (
        <>
      {/* Davet kodu üretimi */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-slate-200">
              Öğrenci Davet Kodu
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Kodu öğrencinle paylaş; hesabına girdiğinde bağlantı kurulur.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateInvite}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Yeni Öğrenci Davet Kodu Üret
          </button>
        </div>

        <AnimatePresence>
          {freshCode ? (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <span className="text-xs font-medium text-emerald-200">
                  Yeni kodun
                </span>
                <code className="rounded-lg bg-slate-950/60 px-3 py-1.5 font-mono text-lg tracking-wider text-emerald-100">
                  {freshCode}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopy(freshCode)}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {invites.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-slate-400">
              Bekleyen davetler ({invites.length})
            </p>
            <ul className="flex flex-wrap gap-2">
              {invites.map((invite) => (
                <li key={invite.id}>
                  <button
                    type="button"
                    onClick={() => void handleCopy(invite.inviteCode)}
                    title="Kopyalamak için tıkla"
                    className="group flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 font-mono text-sm text-slate-300 transition hover:border-indigo-400/40 hover:text-white"
                  >
                    {invite.inviteCode}
                    <Copy className="size-3 text-slate-600 transition group-hover:text-indigo-300" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Öğrenci tablosu */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-medium text-slate-200">Öğrencilerim</h2>
        </div>

        {students.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <UserRound className="mx-auto size-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-400">
              Henüz bağlı öğrencin yok.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Yukarıdan bir davet kodu üretip öğrencinle paylaş.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3 font-medium">Öğrenci Adı</th>
                  <th className="px-6 py-3 font-medium">Hedef Sınavlar</th>
                  <th className="px-6 py-3 font-medium">Bağlantı Durumu</th>
                  <th className="px-6 py-3 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {students.map((student) => (
                  <tr
                    key={student.linkId}
                    className="transition hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-100">
                        {student.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {student.email}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {student.curriculums.length === 0 ? (
                        <span className="text-xs text-slate-600">
                          Belirtilmemiş
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {student.curriculums.map((code) => (
                            <span
                              key={code}
                              className="rounded-full border border-sky-400/30 bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-200"
                            >
                              {curriculumLabel(code)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                        Aktif · {formatDate(student.linkedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setStudentMessageTarget({
                              partnerId: student.studentId,
                              partnerLabel: student.fullName,
                              contextLabel: 'Genel mesaj',
                            })
                          }
                          className="relative inline-flex items-center gap-1 rounded-md border border-violet-400/45 bg-violet-500/15 px-2.5 py-1 text-[11px] font-medium text-violet-100 transition hover:bg-violet-500/25"
                        >
                          <MessageCircle className="size-3" />
                          <span aria-hidden>💬</span>
                          Mesaj Gönder
                          <UnreadMessageBadge
                            count={
                              unreadByAssignment[
                                unreadGeneralScopeKey(student.studentId)
                              ] ?? 0
                            }
                            className="absolute -top-1.5 -right-1.5"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCareerInsightTarget({
                              studentId: student.studentId,
                              fullName: student.fullName,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/12 px-2.5 py-1 text-[11px] font-medium text-violet-100 transition hover:bg-violet-500/22"
                        >
                          <span aria-hidden>🎯</span>
                          Yetkinlik & Kariyer
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAnalyticsTarget({
                              studentId: student.studentId,
                              fullName: student.fullName,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/22"
                        >
                          <span aria-hidden>📊</span>
                          Gelişim & Analiz
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(student.linkId)}
                          disabled={pending && removingId === student.linkId}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-50"
                        >
                          {pending && removingId === student.linkId ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                          Bağlantıyı Kaldır
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      <MessageConversationModal
        target={studentMessageTarget}
        onClose={() => {
          setStudentMessageTarget(null);
          router.refresh();
        }}
        onLoadConversation={onLoadConversation}
        onSendMessage={onSendMessage}
        onMarkRead={onMarkMessagesRead}
      />

      <TeacherStudentAnalyticsModal
        target={analyticsTarget}
        onClose={() => setAnalyticsTarget(null)}
        onLoadAnalytics={onLoadStudentAnalytics}
      />

      <TeacherStudentCareerInsightModal
        target={careerInsightTarget}
        onClose={() => setCareerInsightTarget(null)}
        onLoadInsight={onLoadStudentCareerInsight}
      />
    </div>
  );
}
