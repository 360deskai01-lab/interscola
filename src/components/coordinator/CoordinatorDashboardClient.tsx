'use client';

import {
  BookOpen,
  Building2,
  Check,
  ClipboardCopy,
  GraduationCap,
  Globe2,
  Loader2,
  MapPin,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  getCoordinatorStudentDetailAction,
  rotateCoordinatorJoinCodeAction,
} from '@/lib/b2b/coordinator-actions';
import {
  formatJoinCodeDisplay,
  normalizeJoinCodeInput,
} from '@/lib/b2b/join-code';
import type {
  CoordinatorMemberSummary,
  CoordinatorOrganizationContext,
  CoordinatorStudentDetail,
} from '@/lib/b2b/coordinator-types';
import type { CoordinatorDashboardTab } from '@/lib/coordinator-dashboard/dashboard-tabs';
import { CoordinatorSidebar } from '@/components/coordinator/CoordinatorSidebar';
import { CoordinatorStudentDrawer } from '@/components/coordinator/CoordinatorStudentDrawer';

function licenseBadgeLabel(raw: string | null): string {
  const t = (raw ?? '').toLowerCase().trim();
  if (!t) return 'Standart';
  if (t.includes('enterprise')) return 'Enterprise';
  if (t.includes('pilot')) return 'Pilot';
  if (t.includes('standard') || t.includes('standart')) return 'Standart';
  return raw!.replace(/_/g, ' ');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type BranchFilterValue = 'all' | string;

function memberMatchesBranch(
  member: CoordinatorMemberSummary,
  branchFilter: BranchFilterValue,
): boolean {
  if (branchFilter === 'all') return true;
  return member.branchId === branchFilter;
}

function BranchFilterBar({
  branches,
  value,
  onChange,
}: {
  branches: CoordinatorOrganizationContext['branches'];
  value: BranchFilterValue;
  onChange: (next: BranchFilterValue) => void;
}): ReactNode {
  return (
    <div
      className="mb-4 flex flex-wrap gap-2"
      role="group"
      aria-label="Şube filtresi"
    >
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          value === 'all'
            ? 'border-indigo-400/45 bg-indigo-500/20 text-indigo-100'
            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-100'
        }`}
      >
        Tüm şubeler
      </button>
      {branches.map((branch) => {
        const active = value === branch.id;
        return (
          <button
            key={branch.id}
            type="button"
            onClick={() => onChange(branch.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'border-indigo-400/45 bg-indigo-500/20 text-indigo-100'
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-100'
            }`}
          >
            {branch.name}
          </button>
        );
      })}
    </div>
  );
}

function statusPill(ok: boolean): ReactNode {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        ok
          ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
          : 'border-amber-400/35 bg-amber-500/10 text-amber-100'
      }`}
    >
      {ok ? 'Aktif' : 'Beklemede'}
    </span>
  );
}

export interface CoordinatorDashboardClientProps {
  activeTab: CoordinatorDashboardTab;
  coordinatorName: string;
  profileEmail: string;
  context: CoordinatorOrganizationContext;
}

export function CoordinatorDashboardClient({
  activeTab,
  coordinatorName,
  profileEmail,
  context,
}: CoordinatorDashboardClientProps): ReactNode {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [rotatePending, startRotateTransition] = useTransition();
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState<string | null>(null);
  const [liveJoinCode, setLiveJoinCode] = useState<string | null>(
    () => context.organization.joinCode,
  );
  const [branchFilter, setBranchFilter] = useState<BranchFilterValue>('all');
  const [detailPending, startDetailTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDetail, setDrawerDetail] =
    useState<CoordinatorStudentDetail | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);

  const org = context.organization;

  const filteredTeachers = useMemo(
    () => context.teachers.filter((m) => memberMatchesBranch(m, branchFilter)),
    [context.teachers, branchFilter],
  );

  const filteredStudents = useMemo(
    () => context.students.filter((m) => memberMatchesBranch(m, branchFilter)),
    [context.students, branchFilter],
  );
  const branchCurrent = useMemo(() => {
    const list = context.branches;
    if (list.length === 0) return 'Merkez (şube tanımsız)';
    if (list.length === 1) return list[0].name;
    return `${list.length} kampüs`;
  }, [context.branches]);

  const licenseBadge = licenseBadgeLabel(org.licenseType);
  useEffect(() => {
    setLiveJoinCode(context.organization.joinCode);
  }, [context.organization.joinCode]);

  const joinCodeDisplay = liveJoinCode?.trim()
    ? formatJoinCodeDisplay(liveJoinCode)
    : '—';
  const perf = context.orgPerformance;
  const satAvg = perf.avgSatScore;
  const satMax = perf.maxSatScore;
  const ieltsAvg = perf.avgIeltsBand;

  const copyJoinCode = useCallback(async () => {
    const raw = liveJoinCode?.trim();
    if (!raw) return;
    const payload = formatJoinCodeDisplay(raw);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [liveJoinCode]);

  function openStudentAcademicDrawer(studentUserId: string) {
    setDrawerOpen(true);
    setDrawerDetail(null);
    setDrawerError(null);
    setLoadingStudentId(studentUserId);
    startDetailTransition(async () => {
      const result = await getCoordinatorStudentDetailAction({
        organizationId: org.id,
        studentProfileId: studentUserId,
      });
      setLoadingStudentId(null);
      if (!result.success) {
        setDrawerError(result.error);
        return;
      }
      setDrawerDetail(result.studentDetail);
    });
  }

  function handleRotateJoinCode() {
    setRotateError(null);
    setRotateSuccess(null);
    startRotateTransition(async () => {
      const result = await rotateCoordinatorJoinCodeAction({
        organizationId: org.id,
      });
      if (!result.success) {
        setRotateError(result.error);
        setRotateConfirmOpen(false);
        return;
      }
      const normalized = normalizeJoinCodeInput(result.newJoinCode);
      setLiveJoinCode(normalized || result.newJoinCode);
      setRotateConfirmOpen(false);
      setRotateSuccess('Yeni katılım kodu başarıyla oluşturuldu.');
      setCopied(false);
      router.refresh();
    });
  }

  return (
    <main className="relative w-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.22),transparent_65%)]"
      />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start">
        <CoordinatorSidebar
          activeTab={activeTab}
          coordinatorName={coordinatorName}
          profileEmail={profileEmail}
          orgName={org.name}
          organization={org}
        />

        <div className="min-w-0 w-full flex-1 space-y-6">
          {activeTab === 'overview' ? (
            <>
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-indigo-950/40 backdrop-blur-sm sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300/90">
                      Kurum komuta merkezi
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {org.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1">
                        <Building2 className="size-4 text-indigo-300" />
                        {branchCurrent}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-violet-100">
                        <GraduationCap className="size-4 text-violet-200" />
                        Koordinatör: {coordinatorName}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Lisans
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-4 py-1.5 text-sm font-semibold ${
                        licenseBadge === 'Enterprise'
                          ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                          : licenseBadge === 'Pilot'
                            ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
                            : 'border-slate-400/30 bg-slate-500/15 text-slate-100'
                      }`}
                    >
                      {licenseBadge}
                    </span>
                    {!org.isActive ? (
                      <span className="text-xs text-amber-200/90">
                        Kurum lisansı pasif görünüyor; yönetici ile iletişime
                        geçin.
                      </span>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Aktif öğretmen
                  </p>
                  <p className="mt-2 flex items-baseline gap-2 text-2xl font-semibold text-white">
                    <Users className="size-6 text-indigo-300" />
                    {context.teachers.length}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Kayıtlı öğrenci
                  </p>
                  <p className="mt-2 flex items-baseline gap-2 text-2xl font-semibold text-white">
                    <GraduationCap className="size-6 text-sky-300" />
                    {context.students.length}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/50 p-5 backdrop-blur-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Çözülen deneme hacmi
                  </p>
                  <p className="mt-2 flex items-baseline gap-2 text-2xl font-semibold tabular-nums text-white">
                    <BookOpen className="size-6 text-violet-300" />
                    {perf.totalCompletedAttempts}
                  </p>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span aria-hidden>🏛️ </span>
                    Kurum SAT ortalaması
                  </p>
                  {satAvg !== null ? (
                    <>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                        {satAvg}
                        <span className="text-sm font-normal text-slate-400">
                          {' '}
                          /1600
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        En yüksek:{' '}
                        <span className="font-medium text-sky-200">
                          {satMax ?? '—'} /1600
                        </span>
                      </p>
                      <div className="mt-3 space-y-1.5">
                        <div className="h-2 overflow-hidden rounded-md bg-slate-800">
                          <div
                            className="h-full rounded-md bg-gradient-to-r from-sky-500 to-indigo-500"
                            style={{
                              width: `${Math.min(100, Math.round((satAvg / 1600) * 100))}%`,
                            }}
                          />
                        </div>
                        {satMax !== null ? (
                          <div className="h-2 overflow-hidden rounded-md bg-slate-800">
                            <div
                              className="h-full rounded-md bg-gradient-to-r from-cyan-400 to-sky-300"
                              style={{
                                width: `${Math.min(100, Math.round((satMax / 1600) * 100))}%`,
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Henüz kurumsal SAT denemesi yok.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span aria-hidden>🌍 </span>
                    Kurum IELTS ortalaması
                  </p>
                  {ieltsAvg !== null ? (
                    <>
                      <p className="mt-2 flex items-baseline gap-2">
                        <span className="inline-flex rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-2xl font-semibold tabular-nums text-emerald-100">
                          {ieltsAvg.toFixed(1)}
                        </span>
                        <Globe2 className="size-5 text-emerald-300/80" aria-hidden />
                      </p>
                      <p className="mt-1 text-xs text-slate-400">Ölçek: /9.0 band</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-md bg-slate-800">
                        <div
                          className="h-full rounded-md bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{
                            width: `${Math.min(100, Math.round((ieltsAvg / 9) * 100))}%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Henüz kurumsal IELTS denemesi yok.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 bg-slate-900/50 p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span aria-hidden>📚 </span>
                    Başarı radarı özeti
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    Öğrenci masası ve şube hiyerarşisi için sol menüden ilgili
                    sekmelere geçin. Kota ve katılım kodu yönetimi menüde
                    görünür.
                  </p>
                </div>
              </section>
            </>
          ) : null}

          {activeTab === 'codes' ? (
            <section className="rounded-2xl border border-indigo-400/20 bg-indigo-950/30 p-6 backdrop-blur-sm sm:p-8">
              <h2 className="text-lg font-semibold text-white">
                Katılım kodları & davet konsolu
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Öğrenciler kuruma bu kod ile bağlanır. Kodu yalnızca kurum
                içinde paylaşın.
              </p>
              {rotateSuccess ? (
                <div
                  role="status"
                  className="mt-4 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                >
                  {rotateSuccess}
                </div>
              ) : null}
              {rotateError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                >
                  {rotateError}
                </div>
              ) : null}
              <p className="mt-6 text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                Okul katılım kodu
              </p>
              <p className="mt-2 break-all font-mono text-2xl font-semibold tracking-wide text-white">
                {joinCodeDisplay}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyJoinCode()}
                  disabled={!liveJoinCode?.trim() || rotatePending}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-4 py-2.5 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-300" />
                  ) : (
                    <ClipboardCopy className="size-4" />
                  )}
                  {copied ? 'Kopyalandı' : 'Kodu kopyala'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRotateError(null);
                    setRotateConfirmOpen(true);
                  }}
                  disabled={rotatePending}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-400/35 bg-amber-500/15 px-4 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {rotatePending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden />
                  )}
                  Kodu yenile / döndür
                </button>
              </div>
              {rotateConfirmOpen ? (
                <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
                  <p className="text-sm leading-relaxed text-amber-50">
                    Mevcut kod geçersiz olacak; yeni kodu öğrencilerinizle
                    paylaşmanız gerekecek. Onaylıyor musunuz?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={rotatePending}
                      onClick={() => handleRotateJoinCode()}
                      className="inline-flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-500/25 px-3 py-2 text-sm font-medium text-amber-50 hover:bg-amber-500/35 disabled:opacity-50"
                    >
                      {rotatePending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      Evet, kodu döndür
                    </button>
                    <button
                      type="button"
                      disabled={rotatePending}
                      onClick={() => setRotateConfirmOpen(false)}
                      className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : null}
              <p className="mt-6 text-sm leading-relaxed text-slate-400">
                Öğrenci yolu:{' '}
                <span className="text-slate-200">
                  Öğrenci paneli → Hedefler & kurum
                </span>{' '}
                adımında join_code girilir. Kota dolduğunda yeni öğrenci
                bağlantısı engellenir; sol menüdeki kota kalkanı durumu
                gösterir.
              </p>
            </section>
          ) : null}

          {activeTab === 'teachers' ? (
            <section className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-100">
                Öğretmen kadrosu
              </h2>
              <BranchFilterBar
                branches={context.branches}
                value={branchFilter}
                onChange={setBranchFilter}
              />
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3.5 font-medium">Ad Soyad</th>
                      <th className="px-4 py-3.5 font-medium">E-posta</th>
                      <th className="px-4 py-3.5 font-medium">Şube</th>
                      <th className="min-w-[100px] whitespace-nowrap py-3.5 pl-4 pr-6 text-right font-medium">
                        Durum
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          {context.teachers.length === 0
                            ? 'Henüz kayıtlı öğretmen yok.'
                            : 'Bu şube için öğretmen bulunamadı.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((t) => (
                        <tr key={t.id} className="text-slate-200">
                          <td className="px-4 py-3.5 font-medium text-white">
                            {t.displayName}
                          </td>
                          <td className="px-4 py-3.5 text-slate-400">
                            {t.email ?? '—'}
                          </td>
                          <td className="px-4 py-3.5 text-slate-300">
                            {t.branchName ?? '—'}
                          </td>
                          <td className="min-w-[100px] whitespace-nowrap py-3.5 pl-4 pr-6 text-right">
                            {statusPill(true)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === 'students' ? (
            <section className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-100">
                Kayıtlı öğrenciler
              </h2>
              <BranchFilterBar
                branches={context.branches}
                value={branchFilter}
                onChange={setBranchFilter}
              />
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3.5 font-medium">Ad Soyad</th>
                      <th className="px-4 py-3.5 font-medium">Son deneme</th>
                      <th className="px-4 py-3.5 font-medium">Hedef sınavlar</th>
                      <th className="whitespace-nowrap px-4 py-3.5 font-medium">
                        Kayıt tarihi
                      </th>
                      <th className="min-w-[150px] whitespace-nowrap py-3.5 pl-4 pr-6 text-right font-medium">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          {context.students.length === 0
                            ? 'Henüz öğrenci bağlanmamış.'
                            : 'Bu şube için öğrenci bulunamadı.'}
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => (
                        <tr key={s.id} className="text-slate-200">
                          <td className="px-4 py-3.5 font-medium text-white">
                            {s.displayName}
                          </td>
                          <td className="px-4 py-3.5">
                            {s.lastAttemptDisplay ? (
                              <span className="inline-flex rounded-md border border-indigo-400/25 bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-100">
                                {s.lastAttemptDisplay}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500">
                                Henüz deneme çözülmedi
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            {s.targetExamLabels.length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {s.targetExamLabels.map((tag) => (
                                  <span
                                    key={`${s.id}-${tag}`}
                                    className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-100"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-slate-400">
                            {formatDate(s.memberCreatedAt)}
                          </td>
                          <td className="min-w-[150px] whitespace-nowrap py-3.5 pl-4 pr-6 text-right">
                            <button
                              type="button"
                              disabled={
                                detailPending && loadingStudentId === s.userId
                              }
                              onClick={() => openStudentAcademicDrawer(s.userId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-1.5 text-[11px] font-medium text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-50"
                            >
                              {detailPending &&
                              loadingStudentId === s.userId ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <span aria-hidden>📊</span>
                              )}
                              Akademik karne / incele
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === 'branches' ? (
            <section className="w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 p-6">
              <h2 className="mb-4 text-base font-semibold text-slate-100">
                Şubeler & kampüsler
              </h2>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3.5 font-medium">Kampüs</th>
                      <th className="px-4 py-3.5 font-medium">Şehir</th>
                      <th className="px-4 py-3.5 font-medium">Öğretmen</th>
                      <th className="min-w-[100px] whitespace-nowrap py-3.5 pl-4 pr-6 text-right font-medium">
                        Öğrenci
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {context.branches.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          Tanımlı şube yok; tüm öğretmen/öğrenciler merkeze bağlı
                          olabilir.
                        </td>
                      </tr>
                    ) : (
                      context.branches.map((b) => (
                        <tr key={b.id} className="text-slate-200">
                          <td className="px-4 py-3.5 font-medium text-white">
                            {b.name}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1.5 text-slate-400">
                              <MapPin className="size-3.5 text-slate-500" />
                              {b.city?.trim() || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 tabular-nums text-slate-300">
                            {b.activeTeacherCount}
                          </td>
                          <td className="min-w-[100px] whitespace-nowrap py-3.5 pl-4 pr-6 text-right tabular-nums text-slate-300">
                            {b.activeStudentCount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <CoordinatorStudentDrawer
        open={drawerOpen}
        loading={detailPending}
        error={drawerError}
        detail={drawerDetail}
        onClose={() => setDrawerOpen(false)}
      />
    </main>
  );
}
