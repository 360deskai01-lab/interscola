'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardList,
  Clock,
  Copy,
  ListChecks,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
  Users,
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
  LibraryAssignmentHistoryRow,
  LibraryItem,
  TeacherAssignmentProgressRow,
} from '@/app/teacher/library-actions';
import type { FacultyColleague } from '@/app/teacher/faculty-actions';
import type { WeeklyDigestRow } from '@/app/teacher/digest-actions';
import {
  MessageConversationModal,
  type MessageThreadTarget,
} from '@/components/messages/MessageConversationModal';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';
import {
  unreadFacultyScopeKey,
  unreadGeneralScopeKey,
} from '@/lib/message-unread-scopes';
import type { StudentAnalyticsData } from '@/lib/student-analytics';
import { TeacherAssignmentsProgressSection } from '@/components/teacher/TeacherAssignmentsProgressSection';
import { TeacherLibrarySection } from '@/components/teacher/TeacherLibrarySection';
import { TeacherMessagesHubSection } from '@/components/teacher/TeacherMessagesHubSection';
import { TeacherSidebar } from '@/components/teacher/TeacherSidebar';
import { FacultyBoardModal } from '@/components/teacher/FacultyBoardModal';
import { WeeklyDigestModal } from '@/components/teacher/WeeklyDigestModal';
import {
  TeacherStudentAnalyticsModal,
  type TeacherAnalyticsStudentTarget,
} from '@/components/teacher/TeacherStudentAnalyticsModal';
import {
  TeacherStudentCareerInsightModal,
  type TeacherCareerInsightTarget,
} from '@/components/teacher/TeacherStudentCareerInsightModal';
import type { StudentCareerInsightForTeacher } from '@/lib/student-dashboard/teacher-career-insight';
import type { TeacherDashboardTab } from '@/lib/teacher-dashboard/dashboard-tabs';
import { TeacherExamRadarChip } from '@/components/teacher/TeacherExamRadarChip';
import type { OfficialExamScheduleSummary } from '@/types/exam-radar';
import type {
  CreateTeacherAssignmentInput,
  TeacherAssignmentStudentOption,
} from '@/lib/b2b/teacher-assignment-actions';
import type { TeacherAssignmentReviewDetail } from '@/lib/b2b/teacher-assignment-review-types';
import type { TeacherAssignSubmitResult } from '@/components/teacher/TeacherAssignFromLibraryModal';

interface TeacherPanelProps {
  activeTab: TeacherDashboardTab;
  profileEmail: string;
  displayName: string | null;
  students: TeacherStudent[];
  invites: TeacherInvite[];
  libraryItems: LibraryItem[];
  assignmentProgress: TeacherAssignmentProgressRow[];
  assignmentStudentPool: TeacherAssignmentStudentOption[];
  orgContext: TeacherOrganizationContext | null;
  onCreateInvite: () => Promise<{
    success: boolean;
    error?: string;
    inviteCode?: string;
  }>;
  onRemoveStudent: (
    linkId: string,
  ) => Promise<{ success: boolean; error?: string }>;
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
  onCreateTeacherAssignment: (
    input: CreateTeacherAssignmentInput,
  ) => Promise<TeacherAssignSubmitResult>;
  onGetAssignmentReview: (assignmentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: TeacherAssignmentReviewDetail;
  }>;
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
  unreadByAssignment: Record<string, number>;
  unreadMessageTotal: number;
  onLoadStudentFaculty: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: FacultyColleague[];
  }>;
  onGenerateWeeklyDigest: (studentId: string) => Promise<{
    success: boolean;
    error?: string;
    data?: WeeklyDigestRow;
  }>;
  onPublishWeeklyDigest: (
    digestId: string,
    body?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
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
  stats: {
    studentCount: number;
    pendingInvites: number;
    totalAttempts: number;
    libraryMaterialCount: number;
    assignmentVolume: number;
  };
  panelDataError: string | null;
  nearestOfficialExam: OfficialExamScheduleSummary | null;
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

function OverviewStatCard({
  icon: Icon,
  label,
  value,
  accent,
  breakdown,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
  breakdown?: string;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br ${accent} shadow-lg`}
        >
          <Icon className="size-5 text-slate-950" />
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </div>
      {breakdown ? (
        <p className="mt-3 text-xs text-slate-500">{breakdown}</p>
      ) : null}
    </div>
  );
}

/** Öğretmen panelinin etkileşimli kısmı (sol menü + sekme içeriği). */
export function TeacherPanel({
  activeTab,
  profileEmail,
  displayName,
  students,
  invites,
  libraryItems,
  assignmentProgress,
  assignmentStudentPool,
  orgContext,
  onCreateInvite,
  onRemoveStudent,
  onCreateLibrary,
  onAssignMaterial,
  onAssignGeneratedExam,
  onGenerateExamFromLibrary,
  onLoadLibraryAssignmentHistory,
  onCreateTeacherAssignment,
  onGetAssignmentReview,
  onLoadConversation,
  onSendMessage,
  onMarkMessagesRead,
  unreadByAssignment,
  unreadMessageTotal,
  onLoadStudentFaculty,
  onGenerateWeeklyDigest,
  onPublishWeeklyDigest,
  onLoadStudentAnalytics,
  onLoadStudentCareerInsight,
  stats,
  panelDataError,
  nearestOfficialExam,
}: TeacherPanelProps): ReactNode {
  const router = useRouter();
  const [studentMessageTarget, setStudentMessageTarget] =
    useState<MessageThreadTarget | null>(null);
  const [facultyMessageTarget, setFacultyMessageTarget] =
    useState<MessageThreadTarget | null>(null);
  const [facultyBoardStudentId, setFacultyBoardStudentId] = useState<
    string | null
  >(null);
  const [facultyBoardStudentName, setFacultyBoardStudentName] =
    useState<string>('');
  const [digestStudentId, setDigestStudentId] = useState<string | null>(null);
  const [digestStudentName, setDigestStudentName] = useState<string>('');
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
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <TeacherSidebar
        activeTab={activeTab}
        profileEmail={profileEmail}
        displayName={displayName}
        unreadMessageTotal={unreadMessageTotal}
      />

      <div className="min-w-0 flex-1 space-y-6">
        {panelDataError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
            <span className="leading-relaxed">{panelDataError}</span>
          </div>
        ) : null}

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <TeacherExamRadarChip exam={nearestOfficialExam} />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <OverviewStatCard
                icon={Users}
                label="Bağlı Aktif Öğrenci"
                value={stats.studentCount}
                accent="from-emerald-400 to-teal-500"
              />
              <OverviewStatCard
                icon={BookOpen}
                label="Kütüphane Materyali"
                value={stats.libraryMaterialCount}
                accent="from-violet-400 to-fuchsia-500"
                breakdown="Başlıklı kayıtlar"
              />
              <OverviewStatCard
                icon={ClipboardList}
                label="Atanan Görev Hacmi"
                value={stats.assignmentVolume}
                accent="from-indigo-400 to-cyan-500"
                breakdown="Kütüphaneye bağlı atamalar"
              />
              <OverviewStatCard
                icon={Clock}
                label="Bekleyen Davet"
                value={stats.pendingInvites}
                accent="from-amber-400 to-orange-500"
              />
              <OverviewStatCard
                icon={ListChecks}
                label="Çözülen Toplam Deneme"
                value={stats.totalAttempts}
                accent="from-sky-400 to-indigo-500"
                breakdown={
                  stats.studentCount === 0
                    ? 'Bağlı öğrenci yok'
                    : `${stats.studentCount} öğrencinin toplamı`
                }
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <h2 className="text-sm font-medium text-slate-200">
                Hoş geldin, öğretmen
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Sol menüden sınıfını ve öğrencilerini yönetebilir, materyal ve
                sınav kütüphaneni oluşturabilir, ödev atamalarını takip
                edebilir ve mesajlaşabilirsin. Özet rakamlar yukarıda; detaylar
                ilgili sekmelerde.
              </p>
            </div>
          </div>
        ) : null}

        {activeTab === 'assignments' ? (
          <TeacherAssignmentsProgressSection
            rows={assignmentProgress}
            libraryItems={libraryItems}
            assignmentStudentPool={assignmentStudentPool}
            onCreateTeacherAssignment={onCreateTeacherAssignment}
            onGetAssignmentReview={onGetAssignmentReview}
            unreadByAssignment={unreadByAssignment}
            onLoadConversation={onLoadConversation}
            onSendMessage={onSendMessage}
            onMarkMessagesRead={onMarkMessagesRead}
            onOpenFacultyBoard={(studentId, studentName) => {
              setFacultyBoardStudentId(studentId);
              setFacultyBoardStudentName(studentName);
            }}
            onOpenWeeklyDigest={(studentId, studentName) => {
              setDigestStudentId(studentId);
              setDigestStudentName(studentName);
            }}
          />
        ) : null}

        {activeTab === 'library' ? (
          <TeacherLibrarySection
            items={libraryItems}
            students={students}
            assignmentProgress={assignmentProgress}
            onCreateLibrary={onCreateLibrary}
            onAssignMaterial={onAssignMaterial}
            onAssignGeneratedExam={onAssignGeneratedExam}
            onGenerateExamFromLibrary={onGenerateExamFromLibrary}
            onLoadLibraryAssignmentHistory={onLoadLibraryAssignmentHistory}
          />
        ) : null}

        {activeTab === 'messages' ? (
          <TeacherMessagesHubSection
            students={students}
            unreadByAssignment={unreadByAssignment}
            onLoadConversation={onLoadConversation}
            onSendMessage={onSendMessage}
            onMarkMessagesRead={onMarkMessagesRead}
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
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-slate-200">
                    Öğrenci Davet Kodu
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Kodu öğrencinle paylaş; hesabına girdiğinde bağlantı
                    kurulur.
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

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
              <div className="border-b border-white/10 px-6 py-4">
                <h2 className="text-sm font-medium text-slate-200">
                  Öğrencilerim
                </h2>
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
                        <th className="px-6 py-3 font-medium">
                          Bağlantı Durumu
                        </th>
                        <th className="px-6 py-3 text-right font-medium">
                          İşlem
                        </th>
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
                                onClick={() => {
                                  setFacultyMessageTarget(null);
                                  setStudentMessageTarget({
                                    partnerId: student.studentId,
                                    partnerLabel: student.fullName,
                                    contextLabel: 'Genel mesaj',
                                  });
                                }}
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
                                onClick={() => {
                                  setFacultyBoardStudentId(student.studentId);
                                  setFacultyBoardStudentName(student.fullName);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-fuchsia-400/40 bg-fuchsia-500/12 px-2.5 py-1 text-[11px] font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/22"
                              >
                                <span aria-hidden>🎓</span>
                                Ortak Eğitmenler
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDigestStudentId(student.studentId);
                                  setDigestStudentName(student.fullName);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-500/22"
                              >
                                <span aria-hidden>📝</span>
                                Haftalık Değerlendirme
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
                                disabled={
                                  pending && removingId === student.linkId
                                }
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

        <MessageConversationModal
          key="faculty-teacher-thread"
          target={facultyMessageTarget}
          onClose={() => {
            setFacultyMessageTarget(null);
            router.refresh();
          }}
          onLoadConversation={onLoadConversation}
          onSendMessage={onSendMessage}
          onMarkRead={onMarkMessagesRead}
        />

        <FacultyBoardModal
          studentId={facultyBoardStudentId}
          studentName={facultyBoardStudentName}
          unreadByAssignment={unreadByAssignment}
          onClose={() => {
            setFacultyBoardStudentId(null);
            setFacultyBoardStudentName('');
          }}
          onLoadFaculty={onLoadStudentFaculty}
          onOpenFacultyMessage={(colleague, studentContextId) => {
            setStudentMessageTarget(null);
            setFacultyMessageTarget({
              partnerId: colleague.teacherId,
              partnerLabel: colleague.fullName,
              studentContextId,
              contextLabel: `Ortak öğrenci bağlamı · ${facultyBoardStudentName || 'Öğrenci'}`,
            });
          }}
        />

        <WeeklyDigestModal
          studentId={digestStudentId}
          studentName={digestStudentName}
          onClose={() => {
            setDigestStudentId(null);
            setDigestStudentName('');
          }}
          onGenerate={onGenerateWeeklyDigest}
          onPublish={onPublishWeeklyDigest}
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
    </div>
  );
}
