import { redirect } from 'next/navigation';
import Link from 'next/link';
import { connection } from 'next/server';
import { GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import {
  createInviteFormAction,
  getTeacherOrganizationContextAction,
  getStudentAnalyticsForTeacherFormAction,
  getStudentCareerInsightForTeacherFormAction,
  getTeacherStudentsAction,
  removeStudentFormAction,
} from '../actions';
import {
  assignGeneratedExamFormAction,
  assignMaterialFormAction,
  createLibraryFormAction,
  generateExamFromLibraryFormAction,
  getLibraryAssignmentHistoryFormAction,
  getTeacherAssignmentsProgressAction,
  getTeacherLibraryAction,
} from '../library-actions';
import { getStudentFacultyFormAction } from '../faculty-actions';
import {
  generateStudentWeeklyDigestFormAction,
  publishStudentDigestFormAction,
} from '../digest-actions';
import {
  getConversationFormAction,
  getUnreadCountsByAssignmentAction,
  markMessagesAsReadFormAction,
  sendMessageFormAction,
} from '@/app/messages/actions';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { TeacherDashboardShell } from '@/components/teacher/TeacherDashboardShell';
import { UNREAD_GENERAL_AGGREGATE_KEY } from '@/lib/message-unread-scopes';

export const instant = false;

/**
 * Öğretmen paneli.
 *
 * Yetki kontrolü sunucuda yapılır: oturum yoksa girişe, onaylı öğretmen
 * değilse ana sayfaya yönlendirilir.
 */
export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<ReactNode> {
  await connection();
  await searchParams;

  const current = await getCurrentProfile();

  if (!current) {
    redirect('/auth/login');
  }

  if (
    current.profile.status !== 'approved' ||
    (current.profile.role !== 'teacher' && current.profile.role !== 'admin')
  ) {
    console.warn(
      '[teacher] Yetkisiz panel erişimi:',
      current.user.email,
      '| rol:',
      current.profile.role,
      '| durum:',
      current.profile.status,
    );
    redirect('/');
  }

  const [result, libraryResult, progressResult, orgContextResult, unreadResult] =
    await Promise.all([
      getTeacherStudentsAction(),
      getTeacherLibraryAction(),
      getTeacherAssignmentsProgressAction(),
      getTeacherOrganizationContextAction(),
      getUnreadCountsByAssignmentAction(),
    ]);
  const unreadCounts = unreadResult.counts ?? {};
  const data = result.success ? result.data : undefined;

  const students = data?.students ?? [];
  const invites = data?.invites ?? [];
  const totalAttempts = data?.totalAttempts ?? 0;
  const libraryItems = libraryResult.success ? (libraryResult.data ?? []) : [];
  const assignmentProgress = progressResult.success
    ? (progressResult.data ?? [])
    : [];
  const assignmentVolume = assignmentProgress.filter(
    (row) => row.libraryId !== null,
  ).length;
  const orgContext = orgContextResult.success
    ? orgContextResult.context
    : null;

  const unreadByAssignment = unreadCounts;
  let unreadMessageTotal = 0;
  for (const [key, count] of Object.entries(unreadByAssignment)) {
    if (key === UNREAD_GENERAL_AGGREGATE_KEY) continue;
    unreadMessageTotal += count;
  }

  const panelDataError =
    result.success && libraryResult.success && progressResult.success
      ? null
      : (result.error ??
        libraryResult.error ??
        progressResult.error ??
        'Panel verisi yüklenemedi.');

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(139,92,246,0.18),transparent_60%)]"
      />

      <NavbarServer />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-900/40">
              <GraduationCap className="size-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold tracking-tight">
                  Öğretmen Paneli
                </p>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {current.user.email}
              </p>
              {orgContext ? (
                <p className="mt-2 inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-violet-400/35 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-100">
                  <span aria-hidden>🏛️</span>
                  <span>
                    {orgContext.organizationName}
                    {orgContext.branchName
                      ? ` — ${orgContext.branchName}`
                      : ''}
                  </span>
                </p>
              ) : null}
            </div>
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              ← Sınav Merkezi
            </Link>
          </div>
        </header>

        <TeacherDashboardShell
          profileEmail={current.user.email ?? ''}
          displayName={current.profile.full_name}
          students={students}
          invites={invites}
          libraryItems={libraryItems}
          assignmentProgress={assignmentProgress}
          orgContext={orgContext}
          onCreateInvite={createInviteFormAction}
          onRemoveStudent={removeStudentFormAction}
          onCreateLibrary={createLibraryFormAction}
          onAssignMaterial={assignMaterialFormAction}
          onAssignGeneratedExam={assignGeneratedExamFormAction}
          onGenerateExamFromLibrary={generateExamFromLibraryFormAction}
          onLoadLibraryAssignmentHistory={getLibraryAssignmentHistoryFormAction}
          onLoadConversation={getConversationFormAction}
          onSendMessage={sendMessageFormAction}
          onMarkMessagesRead={markMessagesAsReadFormAction}
          unreadByAssignment={unreadByAssignment}
          unreadMessageTotal={unreadMessageTotal}
          onLoadStudentFaculty={getStudentFacultyFormAction}
          onGenerateWeeklyDigest={generateStudentWeeklyDigestFormAction}
          onPublishWeeklyDigest={publishStudentDigestFormAction}
          onLoadStudentAnalytics={getStudentAnalyticsForTeacherFormAction}
          onLoadStudentCareerInsight={getStudentCareerInsightForTeacherFormAction}
          stats={{
            studentCount: students.length,
            pendingInvites: invites.length,
            totalAttempts,
            libraryMaterialCount: libraryItems.length,
            assignmentVolume,
          }}
          panelDataError={panelDataError}
        />

        <p className="mt-8 text-center text-xs text-slate-600">
          Öğrenci bağlantıları anında güncellenir; sayfa yenilendiğinde liste
          tazelenir.
        </p>
      </div>
    </div>
  );
}
