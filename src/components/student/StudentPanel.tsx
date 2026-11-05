'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Compass,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import type { ConversationMessage } from '@/app/messages/actions';
import { unreadGeneralScopeKey } from '@/lib/message-unread-scopes';
import {
  MessageConversationModal,
  type MessageThreadTarget,
} from '@/components/messages/MessageConversationModal';
import { UnreadMessageBadge } from '@/components/messages/UnreadMessageBadge';
import {
  StudyMaterialReaderModal,
  type StudyMaterialTarget,
} from '@/components/student/StudyMaterialReaderModal';
import type {
  AssignmentProgressStatus,
  LinkedTeacher,
  StudentAnalyticsData,
  StudentAssignment,
} from '@/app/student/actions';
import { StudentAnalyticsSection } from '@/components/student/StudentAnalyticsSection';
import { StudentExploreSection } from '@/components/student/StudentExploreSection';
import type { PublicLibraryItem } from '@/app/student/public-library-actions';
import type {
  JoinOrganizationResult,
  StudentGoalsContext,
  UpdateStudentGoalsPayload,
} from '@/lib/student-profile/types';
import { StudentGoalsModal } from '@/components/student/StudentGoalsModal';
import { StudentCareerAcademicCockpit } from '@/components/student/StudentCareerAcademicCockpit';
import { GuestDataClaimBridge } from '@/components/student/GuestDataClaimBridge';
import type { StudentCommandCenterData } from '@/lib/student-command-center/types';

interface ConnectClaimResult {
  success: boolean;
  error?: string;
  teacherName?: string;
}

interface StudentPanelProps {
  teachers: LinkedTeacher[];
  curriculums: string[];
  assignments: StudentAssignment[];
  goalsContext: StudentGoalsContext;
  commandCenter: StudentCommandCenterData;
  onUpdateStudentGoals: (
    payload: UpdateStudentGoalsPayload,
  ) => Promise<{ success: boolean; error?: string }>;
  onJoinOrganizationByCode: (
    joinCode: string,
  ) => Promise<JoinOrganizationResult>;
  onClaim: (inviteCode: string) => Promise<ConnectClaimResult>;
  onUpdateAssignmentStatus: (
    assignmentId: string,
    status: AssignmentProgressStatus,
  ) => Promise<{ success: boolean; error?: string }>;
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
  analytics: StudentAnalyticsData;
  publicLibraries: PublicLibraryItem[];
  onStartSelfPacedExam: (libraryId: string) => Promise<{
    success: boolean;
    error?: string;
    assignmentId?: string;
  }>;
  onStartDiagnosticExam: () => Promise<{
    success: boolean;
    error?: string;
    assignmentId?: string;
  }>;
}

type StudentPanelTab = 'inbox' | 'explore';

const CURRICULUM_LABELS: Record<string, string> = {
  SAT: 'Digital SAT',
  IELTS: 'IELTS Academic',
  CAIE: 'CAIE A-Level',
};

function curriculumLabel(code: string): string {
  return CURRICULUM_LABELS[code] ?? code;
}

function assignmentTypeLabel(type: StudentAssignment['assignmentType']): string {
  return type === 'exam' ? 'Resmi Sınav' : 'Çalışma Materyali';
}

function assignmentStatusLabel(status: string): string {
  if (status === 'assigned') return 'Atandı';
  if (status === 'completed') return 'Tamamlandı';
  if (status === 'in_progress') return 'Devam ediyor';
  return status;
}

const tableBadge =
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight';
const tableBtn =
  'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium leading-tight transition';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

const DIAGNOSTIC_AI_BUSY_MESSAGE =
  'Yapay zeka motoru yoğunluk yaşıyor. Lütfen aşağıdaki hazır teşhis denemelerinden birini seçerek hemen başlayın.';

function isAiEngineOverloadError(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  const haystack = message.toLowerCase();
  return (
    haystack.includes('429') ||
    haystack.includes('503') ||
    haystack.includes('quota') ||
    haystack.includes('gemini') ||
    haystack.includes('resource exhausted') ||
    haystack.includes('yoğun')
  );
}

/** Öğrenci panelinin etkileşimli kısmı. */
export function StudentPanel({
  teachers,
  curriculums,
  assignments,
  goalsContext,
  commandCenter,
  onUpdateStudentGoals,
  onJoinOrganizationByCode,
  onClaim,
  onUpdateAssignmentStatus,
  onLoadConversation,
  onSendMessage,
  onMarkMessagesRead,
  unreadByAssignment,
  analytics,
  publicLibraries,
  onStartSelfPacedExam,
  onStartDiagnosticExam,
}: StudentPanelProps): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get('tab') === 'explore' ? 'explore' : 'inbox';
  const [panelTab, setPanelTab] = useState<StudentPanelTab>(initialTab);
  const primaryCurriculumLabel =
    curriculums.length > 0 ? curriculumLabel(curriculums[0]!) : undefined;
  const [messageTarget, setMessageTarget] =
    useState<MessageThreadTarget | null>(null);
  const [studyTarget, setStudyTarget] =
    useState<StudyMaterialTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const [assignmentPending, startAssignmentTransition] = useTransition();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [localAssignments, setLocalAssignments] =
    useState<StudentAssignment[]>(assignments);
  const [busyAssignmentId, setBusyAssignmentId] = useState<string | null>(null);
  const [diagnosticAiBusyNotice, setDiagnosticAiBusyNotice] = useState(false);
  const [goalsModalOpen, setGoalsModalOpen] = useState(false);
  const [localGoalsContext, setLocalGoalsContext] =
    useState<StudentGoalsContext>(goalsContext);

  useEffect(() => {
    setLocalAssignments(assignments);
  }, [assignments]);

  useEffect(() => {
    setLocalGoalsContext(goalsContext);
  }, [goalsContext]);

  useEffect(() => {
    if (searchParams.get('goals') === 'open') {
      setGoalsModalOpen(true);
    }
  }, [searchParams]);

  async function handleStartDiagnosticExam(): Promise<{
    success: boolean;
    error?: string;
    assignmentId?: string;
  }> {
    const result = await onStartDiagnosticExam();
    if (!result.success && isAiEngineOverloadError(result.error)) {
      setDiagnosticAiBusyNotice(true);
      return { success: false };
    }
    return result;
  }

  const alreadyLinked = teachers.length > 0;

  function openStudyMaterial(item: StudentAssignment) {
    const text = item.studyMaterialText?.trim() ?? '';
    if (!text) {
      setAssignmentError(
        'Bu çalışma materyalinde okunacak metin yok. Eğitmenine mesaj atabilirsin.',
      );
      return;
    }

    if (item.status === 'assigned') {
      handleAssignmentStatus(item.id, 'in_progress', item.status);
    }

    setStudyTarget({
      assignmentId: item.id,
      materialTitle: item.materialTitle,
      studyText: text,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
    });
  }

  function handleCloseMessages() {
    setMessageTarget(null);
    router.refresh();
  }

  function handleAssignmentStatus(
    assignmentId: string,
    nextStatus: AssignmentProgressStatus,
    previousStatus: string,
  ) {
    setAssignmentError(null);
    setBusyAssignmentId(assignmentId);

    setLocalAssignments((current) =>
      current.map((item) =>
        item.id === assignmentId ? { ...item, status: nextStatus } : item,
      ),
    );

    startAssignmentTransition(async () => {
      const result = await onUpdateAssignmentStatus(assignmentId, nextStatus);
      setBusyAssignmentId(null);

      if (!result.success) {
        setLocalAssignments((current) =>
          current.map((item) =>
            item.id === assignmentId
              ? { ...item, status: previousStatus }
              : item,
          ),
        );
        setAssignmentError(result.error ?? 'Durum güncellenemedi.');
        return;
      }

      router.refresh();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const code = inviteCode.trim().toUpperCase();
    if (code.length === 0) {
      setError('Lütfen bir davet kodu gir.');
      return;
    }

    startTransition(async () => {
      const result = await onClaim(code);
      if (!result.success) {
        setError(result.error ?? 'Davet kodu kabul edilemedi.');
        return;
      }
      setInviteCode('');
      setSuccess(
        result.teacherName
          ? `${result.teacherName} ile bağlantı kuruldu.`
          : 'Bağlantı kuruldu.',
      );
    });
  }

  return (
    <div className="space-y-6">
      <GuestDataClaimBridge />
      {!localGoalsContext.hasGoals ? (
        <div
          id="student-goals-entry"
          className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-violet-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-amber-50">
              Hedef skorunu ve üniversitelerini belirle!
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Kabul barajı eşleştirmesi ve gelişim raporları için hedeflerini
              tanımla.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGoalsModalOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/30"
          >
            <span aria-hidden>🎯</span>
            Hedeflerimi & Kurumumu Güncelle
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setGoalsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300 transition hover:border-indigo-400/35 hover:text-white"
          >
            <span aria-hidden>🎯</span>
            Hedeflerimi & Kurumumu Güncelle
          </button>
        </div>
      )}

      <StudentGoalsModal
        open={goalsModalOpen}
        context={localGoalsContext}
        onClose={() => {
          setGoalsModalOpen(false);
          if (searchParams.get('goals') === 'open') {
            router.replace('/student/dashboard');
          }
        }}
        onSaveGoals={async (payload) => {
          const result = await onUpdateStudentGoals(payload);
          if (result.success) {
            const hasScore = Object.keys(payload.targetScores).length > 0;
            const hasUnis = payload.targetUniversityIds.length > 0;
            setLocalGoalsContext((current) => ({
              ...current,
              targetScores: payload.targetScores,
              targetUniversityIds: payload.targetUniversityIds,
              hasGoals: hasScore || hasUnis,
            }));
            router.refresh();
          }
          return result;
        }}
        onJoinOrganization={onJoinOrganizationByCode}
        onJoined={(result) => {
          if (result.orgName) {
            setLocalGoalsContext((current) => ({
              ...current,
              organization: {
                organizationId: current.organization?.organizationId ?? '',
                orgName: result.orgName!,
              },
            }));
            router.refresh();
          }
        }}
      />

      <StudentCareerAcademicCockpit data={commandCenter} />

      {/* Bildirimler */}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
            <span className="leading-relaxed">{error}</span>
          </motion.div>
        ) : null}

        {success ? (
          <motion.div
            key="success"
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
            <span className="leading-relaxed">{success}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
        <button
          type="button"
          onClick={() => setPanelTab('inbox')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            panelTab === 'inbox'
              ? 'bg-gradient-to-r from-sky-500/25 to-indigo-500/20 text-white shadow-inner'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="size-4" />
          Eğitmenlerimden Gelenler
        </button>
        <button
          type="button"
          onClick={() => setPanelTab('explore')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none ${
            panelTab === 'explore'
              ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/20 text-white shadow-inner'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="size-4" />
          <span aria-hidden>🌐</span>
          Keşfet & Açık Sınav Havuzu
        </button>
      </div>

      {panelTab === 'explore' ? (
        <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-cyan-500/[0.04] p-6">
          <AnimatePresence>
            {diagnosticAiBusyNotice ? (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-50"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <p className="min-w-0 flex-1 leading-relaxed">
                  {DIAGNOSTIC_AI_BUSY_MESSAGE}
                </p>
                <button
                  type="button"
                  onClick={() => setDiagnosticAiBusyNotice(false)}
                  className="shrink-0 rounded-md border border-amber-400/30 px-2 py-0.5 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/15"
                  aria-label="Uyarıyı kapat"
                >
                  Kapat
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <StudentExploreSection
            libraries={publicLibraries}
            onStartExam={onStartSelfPacedExam}
            onStartDiagnostic={handleStartDiagnosticExam}
            primaryCurriculumLabel={primaryCurriculumLabel}
          />
        </div>
      ) : null}

      {panelTab !== 'inbox' ? null : (
        <>
      {/* Hedef sınav rozetleri */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
        <h2 className="text-sm font-medium text-slate-200">Hedef Sınavlarım</h2>
        {curriculums.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Kayıt sırasında sınav seçilmemiş.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {curriculums.map((code) => (
              <span
                key={code}
                className="rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1.5 text-sm font-medium text-sky-200"
              >
                {curriculumLabel(code)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Öğretmene bağlan */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-indigo-400" />
          <h2 className="text-sm font-medium text-slate-200">
            Öğretmene Bağlan
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Öğretmeninin verdiği 8 haneli davet kodunu gir.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="INT-XXXX"
            maxLength={12}
            autoComplete="off"
            spellCheck={false}
            aria-label="Davet kodu"
            className="min-w-[180px] flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 font-mono text-sm tracking-wider text-slate-100 uppercase outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/10"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Bağlan
          </button>
        </form>

        {alreadyLinked ? (
          <p className="mt-3 text-xs text-amber-400/80">
            Zaten bağlı bir öğretmenin var. Yeni bağlantı için önce mevcut
            bağlantının kaldırılması gerekir.
          </p>
        ) : null}
      </div>

      {/* Atanan ödevler / materyaller */}
      <div className="overflow-hidden rounded-3xl border border-sky-400/15 bg-sky-500/[0.04]">
        <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
          <ClipboardList className="size-4 text-sky-300" />
          <h2 className="text-sm font-medium text-slate-200">
            Eğitmenlerimden Gelen Ödevler / Materyaller
          </h2>
        </div>

        {assignmentError ? (
          <div
            role="alert"
            className="mx-6 mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
            <span className="leading-relaxed">{assignmentError}</span>
          </div>
        ) : null}

        {localAssignments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ClipboardList className="mx-auto size-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-400">
              Henüz atanmış bir materyal yok.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Eğitmenin sana ödev veya ders materyali atadığında burada görünür.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3 font-medium">Materyal Adı</th>
                  <th className="px-6 py-3 font-medium">Tür</th>
                  <th className="px-6 py-3 font-medium">Eğitmen</th>
                  <th className="px-6 py-3 font-medium">Durum</th>
                  <th className="px-6 py-3 font-medium">Sonuç</th>
                  <th className="px-6 py-3 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {localAssignments.map((item) => {
                  const isBusy =
                    assignmentPending && busyAssignmentId === item.id;
                  return (
                  <tr
                    key={item.id}
                    className="transition hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-100">
                        {item.materialTitle}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {curriculumLabel(item.curriculum)} ·{' '}
                        {formatDate(item.assignedAt)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`${tableBadge} ${
                          item.assignmentType === 'exam'
                            ? 'border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-100'
                            : 'border-sky-400/35 bg-sky-500/15 text-sky-100'
                        }`}
                      >
                        {assignmentTypeLabel(item.assignmentType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {item.teacherName}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`${tableBadge} border-sky-400/30 bg-sky-500/15 text-sky-200`}
                      >
                        {assignmentStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.assignmentType === 'exam' && item.examResult ? (
                        <span
                          className={`${tableBadge} gap-2 border-emerald-400/30 bg-emerald-500/10 text-emerald-100`}
                        >
                          <span className="font-semibold text-emerald-50">
                            {item.examResult.scaledResult}
                          </span>
                          <span className="text-emerald-300/50" aria-hidden>
                            |
                          </span>
                          <span className="text-emerald-200/90">
                            %{Math.round(item.examResult.percentage)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setMessageTarget({
                              partnerId: item.teacherId,
                              partnerLabel: item.teacherName,
                              assignmentId: item.id,
                              contextLabel: item.materialTitle,
                            })
                          }
                          className={`${tableBtn} relative border-sky-400/35 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20`}
                        >
                          <MessageCircle className="size-3" />
                          Mesaj
                          <UnreadMessageBadge
                            compact
                            count={unreadByAssignment[item.id] ?? 0}
                            className="absolute -top-1 -right-1"
                          />
                        </button>

                        {item.assignmentType === 'study' ? (
                          item.status === 'completed' ? (
                            <span
                              className={`${tableBadge} gap-1 border-emerald-400/35 bg-emerald-500/15 text-emerald-100`}
                            >
                              <CheckCircle2 className="size-3" />
                              Tamamlandı
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openStudyMaterial(item)}
                              disabled={isBusy}
                              className={`${tableBtn} border-sky-400/40 bg-sky-500/12 text-sky-100 hover:bg-sky-500/22 disabled:opacity-50`}
                            >
                              <span aria-hidden>📖</span>
                              Oku / Çalış
                            </button>
                          )
                        ) : item.status === 'completed' ? (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/exam-session/${item.id}/review`,
                              )
                            }
                            className={`${tableBtn} border-violet-400/40 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22`}
                          >
                            <span aria-hidden>🔍</span>
                            Karne
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/exam-session/${item.id}`)
                            }
                            className={`${tableBtn} border-fuchsia-400/40 bg-fuchsia-500/12 text-fuchsia-100 hover:bg-fuchsia-500/22`}
                          >
                            <span aria-hidden>📝</span>
                            Sınav
                          </button>
                        )}
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

      <StudentAnalyticsSection analytics={analytics} />

      {/* Eğitmenlerim */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-sm font-medium text-slate-200">Eğitmenlerim</h2>
        </div>

        {teachers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <UserRound className="mx-auto size-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-400">
              Henüz bağlı bir eğitmenin yok.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Davet kodunu girerek bağlanabilirsin.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {teachers.map((teacher) => (
              <li
                key={teacher.linkId}
                className="flex flex-wrap items-center gap-4 px-6 py-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30">
                  <UserRound className="size-5 text-violet-200" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-100">
                    {teacher.fullName}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Mail className="size-3" />
                    {teacher.email}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMessageTarget({
                        partnerId: teacher.teacherId,
                        partnerLabel: teacher.fullName,
                        contextLabel: 'Genel mesaj',
                      })
                    }
                    className="relative flex items-center gap-1.5 rounded-lg border border-indigo-400/35 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20"
                  >
                    <MessageCircle className="size-3.5" />
                    Mesaj
                    <UnreadMessageBadge
                      count={
                        unreadByAssignment[
                          unreadGeneralScopeKey(teacher.teacherId)
                        ] ?? 0
                      }
                      className="absolute -top-1.5 -right-1.5"
                    />
                  </button>
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
                    Aktif · {formatDate(teacher.linkedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
        </>
      )}

      <StudyMaterialReaderModal
        target={studyTarget}
        unreadFromTeacher={
          studyTarget ? (unreadByAssignment[studyTarget.assignmentId] ?? 0) : 0
        }
        onClose={() => {
          setStudyTarget(null);
          router.refresh();
        }}
        onComplete={async (assignmentId) =>
          onUpdateAssignmentStatus(assignmentId, 'completed')
        }
        onAskTeacher={(target) => {
          setStudyTarget(null);
          setMessageTarget({
            partnerId: target.teacherId,
            partnerLabel: target.teacherName,
            assignmentId: target.assignmentId,
            contextLabel: target.materialTitle,
          });
        }}
      />

      <MessageConversationModal
        target={messageTarget}
        onClose={handleCloseMessages}
        onLoadConversation={onLoadConversation}
        onSendMessage={onSendMessage}
        onMarkRead={onMarkMessagesRead}
      />
    </div>
  );
}
