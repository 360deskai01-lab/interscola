import { redirect } from 'next/navigation';
import Link from 'next/link';
import { connection } from 'next/server';
import { GraduationCap, UserRound } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  claimInviteFormAction,
  getStudentAnalyticsAction,
  getStudentAssignmentsAction,
  getStudentTeachersAction,
  updateAssignmentStatusFormAction,
} from '../actions';
import { getStudentCommandCenterDataAction } from '../command-center-data';
import {
  joinOrganizationByCodeAction,
  updateStudentGoalsAction,
} from '../profile-actions';
import type { StudentGoalsContext } from '@/lib/student-profile/types';
import type { StudentCommandCenterData } from '@/lib/student-command-center/types';
import {
  getConversationFormAction,
  getUnreadCountsByAssignmentAction,
  markMessagesAsReadFormAction,
  sendMessageFormAction,
} from '@/app/messages/actions';
import {
  getPublicLibrariesAction,
  startSelfPacedExamFormAction,
  startSmartDiagnosticSelfPacedExamFormAction,
} from '@/app/student/public-library-actions';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { StudentPanel } from '@/components/student/StudentPanel';

export const instant = false;

/**
 * Öğrenci paneli.
 *
 * Yetki kontrolü sunucuda yapılır: oturum yoksa girişe, onaylı öğrenci
 * değilse ana sayfaya yönlendirilir.
 */
export default async function StudentDashboardPage(): Promise<ReactNode> {
  await connection();

  const current = await getCurrentProfile();

  if (!current) {
    redirect('/auth/login');
  }

  if (
    current.profile.status !== 'approved' ||
    current.profile.role !== 'student'
  ) {
    console.warn(
      '[student] Yetkisiz panel erişimi:',
      current.user.email,
      '| rol:',
      current.profile.role,
      '| durum:',
      current.profile.status,
    );
    redirect('/');
  }

  const [
    teachersResult,
    assignmentsResult,
    curriculums,
    unreadResult,
    analyticsResult,
    publicLibrariesResult,
    commandCenterResult,
  ] = await Promise.all([
    getStudentTeachersAction(),
    getStudentAssignmentsAction(),
    readCurriculums(current.user.id),
    getUnreadCountsByAssignmentAction(),
    getStudentAnalyticsAction(),
    getPublicLibrariesAction(),
    getStudentCommandCenterDataAction(),
  ]);

  const teachers = teachersResult.teachers ?? [];
  const assignments = assignmentsResult.assignments ?? [];
  const unreadByAssignment = unreadResult.counts ?? {};
  const analytics = analyticsResult.data ?? {
    attempts: [],
    delta: null,
    learningGaps: [],
  };
  const publicLibraries = publicLibrariesResult.libraries ?? [];

  const emptyGoalsContext: StudentGoalsContext = {
    targetScores: {},
    targetUniversityIds: [],
    organization: null,
    universities: [],
    hasGoals: false,
  };
  const emptyCommandCenter: StudentCommandCenterData = {
    goals: emptyGoalsContext,
    pinnedUniversities: [],
    recentScores: { satScore: null, ieltsBand: null },
    matchScores: { satScore: null, ieltsBand: null, caieGrade: null },
    career: {
      hasAssessment: false,
      topTraits: [],
      radarData: [],
      suggestedMajors: [],
      pinnedUniversityNames: [],
    },
    universityThresholds: [],
  };
  const commandCenter = commandCenterResult.data ?? emptyCommandCenter;
  const goalsContext = commandCenter.goals;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(56,189,248,0.15),transparent_60%)]"
      />

      <NavbarServer />
      <div className="relative mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
        <header className="mb-8 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-900/40">
              <GraduationCap className="size-6" />
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">
                Öğrenci Komuta Merkezi
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {current.user.email}
              </p>
            </div>
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              ← Sınav Merkezi
            </Link>
          </div>
          <Link
            href="/student/dashboard?goals=open"
            className="ml-auto inline-flex items-center gap-2 rounded-full border border-indigo-400/35 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/25"
          >
            <span aria-hidden>🎯</span>
            Hedeflerimi & Kurumumu Güncelle
          </Link>
        </header>

        {!teachersResult.success ||
        !assignmentsResult.success ||
        !analyticsResult.success ||
        !publicLibrariesResult.success ||
        !commandCenterResult.success ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
          >
            <UserRound className="mt-0.5 size-4 shrink-0 text-rose-300" />
            <span className="leading-relaxed">
              {teachersResult.error ??
                assignmentsResult.error ??
                analyticsResult.error ??
                publicLibrariesResult.error ??
                commandCenterResult.error ??
                'Panel verisi yüklenemedi.'}
            </span>
          </div>
        ) : null}

        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-slate-400">
              Panel yükleniyor…
            </div>
          }
        >
          <StudentPanel
            teachers={teachers}
            curriculums={curriculums}
            assignments={assignments}
            goalsContext={goalsContext}
            commandCenter={commandCenter}
            onUpdateStudentGoals={updateStudentGoalsAction}
            onJoinOrganizationByCode={joinOrganizationByCodeAction}
            onClaim={claimInviteFormAction}
            onUpdateAssignmentStatus={updateAssignmentStatusFormAction}
            onLoadConversation={getConversationFormAction}
            onSendMessage={sendMessageFormAction}
            onMarkMessagesRead={markMessagesAsReadFormAction}
            unreadByAssignment={unreadByAssignment}
            analytics={analytics}
            publicLibraries={publicLibraries}
            onStartSelfPacedExam={startSelfPacedExamFormAction}
            onStartDiagnosticExam={startSmartDiagnosticSelfPacedExamFormAction}
          />
        </Suspense>

        <p className="mt-8 text-center text-xs text-slate-600">
          Bağlantı kurulduğunda öğretmenin denemelerini görebilir.
        </p>
      </div>
    </div>
  );
}

/**
 * Hedef sınavlar `profiles` tablosunda değil, kayıt sırasında
 * `auth.users.user_metadata.selected_curriculums` alanına yazılıyor.
 */
async function readCurriculums(userId: string): Promise<string[]> {
  const admin = getSupabaseAdmin('public');
  if (!admin) return [];

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) return [];

    const raw = data.user.user_metadata?.selected_curriculums;
    if (!Array.isArray(raw)) return [];

    return raw.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}
