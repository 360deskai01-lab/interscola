import { redirect } from 'next/navigation';
import Link from 'next/link';
import { connection } from 'next/server';
import {
  AlertTriangle,
  Clock,
  GraduationCap,
  ListChecks,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { getCurrentProfile } from '@/lib/auth';
import {
  createInviteFormAction,
  getTeacherOrganizationContextAction,
  getStudentAnalyticsForTeacherFormAction,
  getTeacherStudentsAction,
  removeStudentFormAction,
} from '../actions';
import {
  assignGeneratedExamFormAction,
  assignMaterialFormAction,
  createLibraryFormAction,
  generateExamFromLibraryFormAction,
  getTeacherAssignmentsProgressAction,
  getTeacherLibraryAction,
} from '../library-actions';
import {
  getConversationFormAction,
  getUnreadCountsByAssignmentAction,
  markMessagesAsReadFormAction,
  sendMessageFormAction,
} from '@/app/messages/actions';
import { NavbarServer } from '@/components/navigation/NavbarServer';
import { TeacherPanel } from '@/components/teacher/TeacherPanel';

export const instant = false;

/**
 * Öğretmen paneli.
 *
 * Yetki kontrolü sunucuda yapılır: oturum yoksa girişe, onaylı öğretmen
 * değilse ana sayfaya yönlendirilir.
 */
export default async function TeacherDashboardPage(): Promise<ReactNode> {
  await connection();

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
  const unreadByAssignment = unreadResult.counts ?? {};
  const data = result.success ? result.data : undefined;

  const students = data?.students ?? [];
  const invites = data?.invites ?? [];
  const totalAttempts = data?.totalAttempts ?? 0;
  const libraryItems = libraryResult.success ? (libraryResult.data ?? []) : [];
  const assignmentProgress = progressResult.success
    ? (progressResult.data ?? [])
    : [];
  const orgContext = orgContextResult.success
    ? orgContextResult.context
    : null;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(139,92,246,0.18),transparent_60%)]"
      />

      <NavbarServer />
      <div className="relative mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <header className="mb-8 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-900/40">
              <GraduationCap className="size-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold tracking-tight">
                  Öğretmen Paneli
                </p>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {current.user.email}
              </p>
              {orgContext ? (
                <p className="mt-2 inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-violet-400/35 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-100">
                  <span aria-hidden>🏛️</span>
                  <span>
                    {orgContext.organizationName}
                    {orgContext.branchName
                      ? ` — ${orgContext.branchName}`
                      : ''}{' '}
                    (Rol: {orgContext.orgRoleLabel})
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

        {!result.success ||
        !libraryResult.success ||
        !progressResult.success ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
            <span className="leading-relaxed">
              {result.error ??
                libraryResult.error ??
                progressResult.error ??
                'Panel verisi yüklenemedi.'}
            </span>
          </div>
        ) : null}

        {/* İstatistikler */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={Users}
            label="Bağlı Aktif Öğrenci"
            value={students.length}
            accent="from-emerald-400 to-teal-500"
          />
          <StatCard
            icon={Clock}
            label="Bekleyen Davet"
            value={invites.length}
            accent="from-amber-400 to-orange-500"
          />
          <StatCard
            icon={ListChecks}
            label="Çözülen Toplam Deneme"
            value={totalAttempts}
            accent="from-sky-400 to-indigo-500"
            breakdown={
              students.length === 0
                ? 'Bağlı öğrenci yok'
                : `${students.length} öğrencinin toplamı`
            }
          />
        </div>

        <TeacherPanel
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
          onLoadConversation={getConversationFormAction}
          onSendMessage={sendMessageFormAction}
          onMarkMessagesRead={markMessagesAsReadFormAction}
          unreadByAssignment={unreadByAssignment}
          onLoadStudentAnalytics={getStudentAnalyticsForTeacherFormAction}
        />

        <p className="mt-8 text-center text-xs text-slate-600">
          Öğrenci bağlantıları anında güncellenir; sayfa yenilendiğinde liste
          tazelenir.
        </p>
      </div>
    </div>
  );
}

function StatCard({
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
