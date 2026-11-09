import { redirect } from 'next/navigation';
import Link from 'next/link';
import { connection } from 'next/server';
import { Building2, Clock, ListChecks, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { getCurrentProfile, type ProfileRecord } from '@/lib/auth';
import { getSupabaseAdmin, PROFILES_SCHEMA } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase/server';
import { approveUserAction, rejectUserAction } from '../actions';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import {
  adminDashboardHref,
  parseAdminDashboardTab,
  type AdminDashboardTab,
} from '@/lib/admin/dashboard-tabs';
import {
  assignMemberFormAction,
  createBranchFormAction,
  createOrganizationFormAction,
  getB2BManagementDataAction,
  removeBranchFormAction,
  updateBranchFormAction,
  generateJoinCodeFormAction,
} from '../b2b-actions';
import { GlobalExamAuditSection } from '@/components/admin/GlobalExamAuditSection';
import { getGlobalExamAuditLogsAction } from '../audit-actions';
import { B2BManagementSection } from '@/components/admin/B2BManagementSection';
import { UniversityManagementSection } from '@/components/admin/UniversityManagementSection';
import { UserTable } from '@/components/admin/UserTable';
import {
  bulkImportUniversitiesFormAction,
  getAdminUniversitiesAction,
  toggleUniversityFeaturedFormAction,
  updateUniversityStatusFormAction,
  upsertSingleUniversityFormAction,
} from '../university-actions';
import { getIntelligenceAlertsAction } from '../intelligence-actions';
import { IntelligenceSection } from '@/components/admin/IntelligenceSection';

/*
 * Bu sayfa oturum çerezini okur ve kişiye özel veri gösterir; önceden
 * oluşturulamaz.
 *
 * NEDEN İKİSİ BİRDEN: `await connection()` prerender sırasındaki dinamik veri
 * erişimini işaretler, ancak Next.js 16 `cacheComponents` modunda bu tek başına
 * yeterli değil — build "uncached data during prerendering" hatası veriyor.
 * `instant = false` bloklayıcı route olduğunu bildirir ve build'i geçirir.
 * Bu ikisi redundant değil, birbirini tamamlıyor.
 */
export const instant = false;

/* Rol ve durum etiketleri `UserTable` bileşenine taşındı. */

/**
 * Tüm profilleri okur. Admin satırları listeye dahil edilmez.
 *
 * OKUMA STRATEJİSİ: önce service role (RLS baypas), yoksa çerezli SSR istemci.
 * `profiles` tablosu `public` şemasındadır; yanlış şemayla sorgulamak boş
 * sonuç ve anlamsız hata nesnesi üretiyordu.
 */
async function fetchProfiles(): Promise<ProfileRecord[]> {
  // 1) Service role (doğru şema ile)
  const adminClient = getSupabaseAdmin(PROFILES_SCHEMA);

  if (adminClient) {
    try {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email, full_name, role, status, created_at, updated_at')
        .neq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(
          '[admin] Profil sorgu hatası:',
          error?.message || error,
        );
      } else {
        return (data ?? []) as ProfileRecord[];
      }
    } catch (error) {
      console.error(
        '[admin] Profil sorgu hatası:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  // 2) Çerezli SSR istemci (service role yoksa veya başarısızsa)
  try {
    const supabase = await getSupabaseServer(PROFILES_SCHEMA);
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, status, created_at, updated_at')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin] Profil sorgu hatası:', error?.message || error);
      return [];
    }

    return (data ?? []) as ProfileRecord[];
  } catch (error) {
    console.error(
      '[admin] Profil sorgu hatası:',
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

/** Panelde gösterilen sayısal özetler. */
interface DashboardStats {
  attemptsTotal: number;
  organizationsActive: number;
}

/**
 * Deneme ve kurum sayılarını okur.
 *
 * `assessment_attempts` farklı şemada (`interscola`) olduğu için şema
 * geçersiz kılınarak sayılır. Hata durumunda 0 döner; istatistik kartı
 * yüzünden panelin çökmesi kabul edilemez.
 */
async function fetchStats(): Promise<DashboardStats> {
  const attemptsClient = getSupabaseAdmin('interscola');
  const publicClient = getSupabaseAdmin(PROFILES_SCHEMA);

  let attemptsTotal = 0;
  let organizationsActive = 0;

  if (attemptsClient) {
    try {
      const { count, error } = await attemptsClient
        .from('assessment_attempts')
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error('[admin] Deneme sayı hatası:', error?.message || error);
      } else {
        attemptsTotal = count ?? 0;
      }
    } catch (error) {
      console.error(
        '[admin] Deneme sayı hatası:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  if (publicClient) {
    try {
      const { count, error } = await publicClient
        .from('organizations')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) {
        console.error('[admin] Kurum sayı hatası:', error?.message || error);
      } else {
        organizationsActive = count ?? 0;
      }
    } catch (error) {
      console.error(
        '[admin] Kurum sayı hatası:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return { attemptsTotal, organizationsActive };
}

/**
 * Yönetici paneli.
 *
 * Yetki kontrolü sunucuda yapılır: oturum yoksa, rol admin değilse veya
 * durum approved değilse kullanıcı doğrudan giriş sayfasına gönderilir.
 */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}): Promise<ReactNode> {
  /*
   * Prerender'ı durdurur: bu sayfa oturum çerezine ve canlı veriye bağlıdır.
   * `connection()`, Next.js 16'da "unstable value (Date.now) while prerendering"
   * hatasını önleyen resmî yoldur.
   */
  await connection();

  const current = await getCurrentProfile();

  if (!current) {
    // Neden null döndüğünü teşhis edilebilir kılmak için ayrıntılı log.
    const { getSessionUser } = await import('@/lib/auth');
    const sessionUser = await getSessionUser();
    console.error(
      '[admin] Panel erişimi reddedildi. Oturum:',
      sessionUser ? sessionUser.email : 'yok',
      '| neden:',
      sessionUser
        ? 'profil okunamadı (profiles şema/RLS sorunu)'
        : 'oturum çerezi sunucuda görünmüyor',
    );
    redirect('/auth/login');
  }

  console.log(
    '[admin] Panel erişimi:',
    current.user.email,
    '| rol:',
    current.profile.role,
    '| durum:',
    current.profile.status,
    '| kaynak:',
    current.source,
  );

  /*
   * Admin ve approved olmayan kullanıcı panele giremez.
   * Bu kontrol service-role okumasından sonra yapıldığı için güvenilirdir.
   */
  if (
    current.profile.role !== 'admin' ||
    current.profile.status !== 'approved'
  ) {
    console.warn(
      '[admin] Yetkisiz erişim denemesi:',
      current.user.email,
      '| rol:',
      current.profile.role,
      '| durum:',
      current.profile.status,
    );
    redirect('/');
  }

  const params = await searchParams;
  const activeFilter: AdminDashboardTab = parseAdminDashboardTab(
    params.tab,
    params.status,
  );

  const [
    profiles,
    stats,
    b2bResult,
    universitiesResult,
    intelligenceResult,
    auditResult,
  ] = await Promise.all([
    fetchProfiles(),
    fetchStats(),
    getB2BManagementDataAction(),
    getAdminUniversitiesAction(),
    getIntelligenceAlertsAction(),
    getGlobalExamAuditLogsAction({ page: 1, limit: 25 }),
  ]);

  const intelligencePendingCount = intelligenceResult.success
    ? (intelligenceResult.data?.pendingCount ?? 0)
    : 0;
  const auditTotalCount = auditResult.success
    ? (auditResult.data?.metrics.totalAttempts ?? stats.attemptsTotal)
    : stats.attemptsTotal;

  const counts = {
    total: profiles.length,
    pending: profiles.filter((p) => p.status === 'pending').length,
    approved: profiles.filter((p) => p.status === 'approved').length,
    rejected: profiles.filter((p) => p.status === 'rejected').length,
    students: profiles.filter((p) => p.role === 'student').length,
    teachers: profiles.filter((p) => p.role === 'teacher').length,
  };

  const visible =
    activeFilter === 'b2b' ||
    activeFilter === 'universities' ||
    activeFilter === 'intelligence' ||
    activeFilter === 'audit'
      ? []
      : activeFilter === 'all'
        ? profiles
        : profiles.filter((p) => p.status === activeFilter);

  const adminDisplayName =
    typeof current.profile.full_name === 'string'
      ? current.profile.full_name
      : null;

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(99,102,241,0.18),transparent_60%)]"
      />

      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <AdminSidebar
            activeTab={activeFilter}
            profileEmail={current.user.email ?? ''}
            displayName={adminDisplayName}
            pendingCount={counts.pending}
            intelligencePendingCount={intelligencePendingCount}
          />

          <main className="min-w-0 flex-1 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                href={adminDashboardHref('all')}
                isActive={activeFilter === 'all'}
                icon={Users}
                label="Toplam Kullanıcı"
                value={counts.total}
                accent="from-slate-600 to-slate-700"
                breakdown={`${counts.students} öğrenci · ${counts.teachers} öğretmen`}
              />
              <StatCard
                href={adminDashboardHref('pending')}
                isActive={activeFilter === 'pending'}
                icon={Clock}
                label="Onay Bekleyenler"
                value={counts.pending}
                accent="from-amber-400 to-orange-500"
              />
              <StatCard
                href={adminDashboardHref('audit')}
                isActive={activeFilter === 'audit'}
                icon={ListChecks}
                label="Çözülen Deneme"
                value={auditTotalCount}
                accent="from-sky-400 to-indigo-500"
              />
              <StatCard
                href={adminDashboardHref('b2b')}
                isActive={activeFilter === 'b2b'}
                icon={Building2}
                label="Aktif Kurum"
                value={stats.organizationsActive}
                accent="from-fuchsia-400 to-purple-600"
              />
            </div>

            {activeFilter === 'b2b' ? (
          <B2BManagementSection
            data={b2bResult.success ? (b2bResult.data ?? null) : null}
            loadError={b2bResult.success ? undefined : b2bResult.error}
            onCreateOrganization={createOrganizationFormAction}
            onCreateBranch={createBranchFormAction}
            onAssignMember={assignMemberFormAction}
            onUpdateBranch={updateBranchFormAction}
            onRemoveBranch={removeBranchFormAction}
            onGenerateJoinCode={generateJoinCodeFormAction}
          />
        ) : activeFilter === 'universities' ? (
          <UniversityManagementSection
            data={universitiesResult.success ? (universitiesResult.data ?? null) : null}
            loadError={
              universitiesResult.success ? undefined : universitiesResult.error
            }
            onToggleFeatured={toggleUniversityFeaturedFormAction}
            onBulkImport={bulkImportUniversitiesFormAction}
            onUpdateStatus={updateUniversityStatusFormAction}
            onUpsertUniversity={upsertSingleUniversityFormAction}
          />
        ) : activeFilter === 'intelligence' ? (
          <IntelligenceSection
            data={
              intelligenceResult.success ? (intelligenceResult.data ?? null) : null
            }
            loadError={
              intelligenceResult.success ? undefined : intelligenceResult.error
            }
          />
        ) : activeFilter === 'audit' ? (
          <GlobalExamAuditSection
            initialData={auditResult.success ? (auditResult.data ?? null) : null}
            loadError={auditResult.success ? undefined : auditResult.error}
          />
            ) : (
              <UserTable
                /*
                 * `key` ile remount: `UserTable` lokal kopya tutuyor. Sunucu
                 * verisi yenilendiğinde (router.refresh sonrası) bileşen yeniden
                 * kurulmalı, aksi halde eski liste görünmeye devam eder.
                 */
                key={`${activeFilter}-${visible.map((p) => p.id).join('-')}`}
                users={visible.map((profile) => ({
                  id: profile.id,
                  email: profile.email,
                  fullName: profile.full_name,
                  role: profile.role,
                  status: profile.status,
                  createdAt: profile.created_at,
                }))}
                onApprove={approveUserAction}
                onReject={rejectUserAction}
              />
            )}

            <p className="text-center text-xs text-slate-600">
              Durum değişiklikleri anında kaydedilir ve panel yenilenir.
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alt bileşenler
// ---------------------------------------------------------------------------

function StatCard({
  href,
  isActive = false,
  icon: Icon,
  label,
  value,
  accent,
  breakdown,
}: {
  href?: string;
  isActive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
  /** Kartın altında görünen ikincil açıklama (ör. öğrenci/öğretmen kırılımı). */
  breakdown?: string;
}): ReactNode {
  const inner = (
    <>
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
    </>
  );

  const className = `rounded-2xl border bg-white/[0.04] p-5 backdrop-blur transition ${
    isActive
      ? 'border-indigo-400/60 ring-2 ring-indigo-500/30'
      : 'border-white/10 hover:border-white/25 hover:bg-white/[0.06]'
  }`;

  if (href) {
    return (
      <Link href={href} className={`block ${className}`}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
