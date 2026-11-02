'use client';

import { useRouter } from 'next/navigation';
import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  formatJoinCodeDisplay,
  JOIN_CODE_LENGTH,
  normalizeJoinCodeInput,
} from '@/lib/b2b/join-code';
import type {
  B2BAssignableUser,
  B2BBranchRow,
  B2BManagementData,
  B2BOrgMemberRow,
  B2BOrganizationRow,
} from '@/app/admin/b2b-actions';

type LicenseType = 'standard' | 'pilot' | 'enterprise';
type OrgRole = 'org_admin' | 'coordinator' | 'teacher';

type ModalKind = 'org' | 'branch' | 'member' | null;

const LICENSE_LABELS: Record<LicenseType, string> = {
  standard: 'Standart',
  pilot: 'Pilot',
  enterprise: 'Kurumsal',
};

const ORG_ROLE_LABELS: Record<string, string> = {
  org_admin: 'Kurum Yöneticisi',
  coordinator: 'Koordinatör',
  teacher: 'Eğitmen',
  student: 'Öğrenci',
};

function orgRoleLabel(role: string): string {
  return ORG_ROLE_LABELS[role] ?? role;
}

interface B2BManagementSectionProps {
  data: B2BManagementData | null;
  loadError?: string;
  onCreateOrganization: (input: {
    name: string;
    license_type: LicenseType;
    student_quota: number;
    valid_until?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onCreateBranch: (input: {
    organizationId: string;
    name: string;
    city?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onAssignMember: (input: {
    organizationId: string;
    branchId: string | null;
    userId: string;
    orgRole: OrgRole;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdateBranch: (input: {
    branchId: string;
    organizationId: string;
    name: string;
    city?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onRemoveBranch: (input: {
    branchId: string;
    organizationId: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onGenerateJoinCode: (
    organizationId: string,
  ) => Promise<{ success: boolean; error?: string; joinCode?: string }>;
}

function licenseBadge(licenseType: string | null): ReactNode {
  const key = (licenseType?.toLowerCase() ?? 'standard') as LicenseType;
  const label = LICENSE_LABELS[key] ?? licenseType ?? '—';
  return (
    <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-200">
      {label}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function quotaLabel(org: B2BOrganizationRow): string {
  const total = org.studentQuota ?? 0;
  const used = org.seatsUsed;
  return `${used} / ${total} Öğrenci`;
}

function OrganizationJoinCodeControls({
  org,
  pending,
  onGenerateJoinCode,
}: {
  org: B2BOrganizationRow;
  pending: boolean;
  onGenerateJoinCode: B2BManagementSectionProps['onGenerateJoinCode'];
}): ReactNode {
  const router = useRouter();
  const [joinPending, startJoinTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [localCode, setLocalCode] = useState<string | null>(org.joinCode);

  useEffect(() => {
    setLocalCode(org.joinCode);
  }, [org.id, org.joinCode]);

  const displayCode = localCode ? formatJoinCodeDisplay(localCode) : null;

  function handleGenerate() {
    startJoinTransition(async () => {
      const result = await onGenerateJoinCode(org.id);
      if (result.success && result.joinCode) {
        setLocalCode(normalizeJoinCodeInput(result.joinCode));
        router.refresh();
      }
    });
  }

  async function handleCopy() {
    if (!localCode) return;
    try {
      await navigator.clipboard.writeText(localCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (!localCode) {
    return (
      <button
        type="button"
        disabled={pending || joinPending}
        onClick={handleGenerate}
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-50"
      >
        {joinPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Kod Üret
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 font-mono text-sm font-semibold tracking-wider text-cyan-100">
        {displayCode}
      </span>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="grid size-8 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:border-white/25 hover:text-white"
        aria-label="Katılım kodunu kopyala"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-400" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      <button
        type="button"
        disabled={pending || joinPending}
        onClick={handleGenerate}
        className="grid size-8 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:border-amber-400/35 hover:text-amber-200 disabled:opacity-50"
        aria-label="Katılım kodunu yenile"
        title="Yeni kod üret"
      >
        {joinPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
      </button>
    </div>
  );
}

export function B2BManagementSection({
  data,
  loadError,
  onCreateOrganization,
  onCreateBranch,
  onAssignMember,
  onUpdateBranch,
  onRemoveBranch,
  onGenerateJoinCode,
}: B2BManagementSectionProps): ReactNode {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [targetOrg, setTargetOrg] = useState<B2BOrganizationRow | null>(null);
  const [expandedOrgIds, setExpandedOrgIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchEditForm, setBranchEditForm] = useState({ name: '', city: '' });

  const organizations = data?.organizations ?? [];
  const branchesByOrganization = data?.branchesByOrganization ?? {};
  const membersByOrganization = data?.membersByOrganization ?? {};
  const assignableUsers = data?.assignableUsers ?? [];

  const [orgForm, setOrgForm] = useState({
    name: '',
    license_type: 'standard' as LicenseType,
    student_quota: 50,
    valid_until: '',
  });

  const [branchForm, setBranchForm] = useState({ name: '', city: '' });

  const [memberForm, setMemberForm] = useState({
    userId: '',
    branchId: '',
    orgRole: 'teacher' as OrgRole,
  });

  function closeModal() {
    setModal(null);
    setTargetOrg(null);
    setActionError(null);
    setBranchForm({ name: '', city: '' });
    setMemberForm({ userId: '', branchId: '', orgRole: 'teacher' });
  }

  function openBranchModal(org: B2BOrganizationRow) {
    setTargetOrg(org);
    setModal('branch');
    setActionError(null);
  }

  function openMemberModal(org: B2BOrganizationRow) {
    setTargetOrg(org);
    setModal('member');
    setActionError(null);
    setMemberForm({ userId: '', branchId: '', orgRole: 'teacher' });
  }

  function handleCreateOrgSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);

    startTransition(async () => {
      const result = await onCreateOrganization({
        name: orgForm.name.trim(),
        license_type: orgForm.license_type,
        student_quota: orgForm.student_quota,
        valid_until: orgForm.valid_until.trim() || undefined,
      });

      if (!result.success) {
        setActionError(result.error ?? 'Kurum eklenemedi.');
        return;
      }

      setOrgForm({
        name: '',
        license_type: 'standard',
        student_quota: 50,
        valid_until: '',
      });
      closeModal();
      router.refresh();
    });
  }

  function handleCreateBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetOrg) return;
    setActionError(null);

    startTransition(async () => {
      const result = await onCreateBranch({
        organizationId: targetOrg.id,
        name: branchForm.name.trim(),
        city: branchForm.city.trim() || undefined,
      });

      if (!result.success) {
        setActionError(result.error ?? 'Şube eklenemedi.');
        return;
      }

      closeModal();
      router.refresh();
    });
  }

  function toggleOrgDetails(orgId: string) {
    setExpandedOrgIds((current) => {
      const next = new Set(current);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  }

  function startBranchEdit(branch: B2BBranchRow) {
    setEditingBranchId(branch.id);
    setBranchEditForm({
      name: branch.name,
      city: branch.city ?? '',
    });
  }

  function handleSaveBranchEdit(organizationId: string, branchId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await onUpdateBranch({
        branchId,
        organizationId,
        name: branchEditForm.name.trim(),
        city: branchEditForm.city.trim() || undefined,
      });
      if (!result.success) {
        setActionError(result.error ?? 'Şube güncellenemedi.');
        return;
      }
      setEditingBranchId(null);
      router.refresh();
    });
  }

  function handleRemoveBranch(organizationId: string, branchId: string) {
    if (
      !window.confirm(
        'Bu şube kaldırılacak. Bağlı yetkililer kurum geneline taşınır (pasife alınır). Devam?',
      )
    ) {
      return;
    }
    setActionError(null);
    startTransition(async () => {
      const result = await onRemoveBranch({ branchId, organizationId });
      if (!result.success) {
        setActionError(result.error ?? 'Şube kaldırılamadı.');
        return;
      }
      router.refresh();
    });
  }

  function handleAssignMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetOrg) return;
    setActionError(null);

    if (!memberForm.userId) {
      setActionError('Lütfen bir kullanıcı seç.');
      return;
    }

    startTransition(async () => {
      const result = await onAssignMember({
        organizationId: targetOrg.id,
        branchId: memberForm.branchId ? memberForm.branchId : null,
        userId: memberForm.userId,
        orgRole: memberForm.orgRole,
      });

      if (!result.success) {
        setActionError(result.error ?? 'Atama yapılamadı.');
        return;
      }

      closeModal();
      router.refresh();
    });
  }

  const branchOptions: B2BBranchRow[] = targetOrg
    ? (branchesByOrganization[targetOrg.id] ?? [])
    : [];

  return (
    <div className="space-y-4">
      {loadError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
          <span>{loadError}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-slate-200">
            Kurumsal Lisans Yönetimi
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Kurum, şube ve yetkili atamalarını buradan yönet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setModal('org');
            setActionError(null);
          }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:brightness-110"
        >
          <Plus className="size-4" />
          Yeni Kurum Ekle
        </button>
      </div>

      {organizations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
          <Building2 className="mx-auto size-9 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            Kayıtlı kurum bulunmuyor.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            İlk kurumsal lisansı oluşturmak için yukarıdaki butonu kullan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/40 md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Kurum</th>
                  <th className="px-4 py-3 font-medium">
                    Katılım Kodu (Student Join Code)
                  </th>
                  <th className="px-4 py-3 font-medium">
                    Kullanılan Kota / Öğrenci
                  </th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr
                    key={`summary-${org.id}`}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {org.name}
                    </td>
                    <td className="px-4 py-3">
                      <OrganizationJoinCodeControls
                        org={org}
                        pending={pending}
                        onGenerateJoinCode={onGenerateJoinCode}
                      />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">
                      {quotaLabel(org)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
          {organizations.map((org) => {
            const isExpanded = expandedOrgIds.has(org.id);
            const orgBranches = branchesByOrganization[org.id] ?? [];
            const orgMembers = (membersByOrganization[org.id] ?? []).filter(
              (member: B2BOrgMemberRow) =>
                member.orgRole === 'coordinator' ||
                member.orgRole === 'teacher' ||
                member.orgRole === 'org_admin',
            );

            return (
            <article
              key={org.id}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    {org.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {licenseBadge(org.licenseType)}
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        org.isActive
                          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
                          : 'border-slate-500/30 bg-slate-500/15 text-slate-300'
                      }`}
                    >
                      {org.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  Bitiş: {formatDate(org.validUntil)}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3">
                <p className="text-xs text-slate-500">
                  Katılım Kodu (Student Join Code)
                </p>
                <div className="mt-2">
                  <OrganizationJoinCodeControls
                    org={org}
                    pending={pending}
                    onGenerateJoinCode={onGenerateJoinCode}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-600">
                  {JOIN_CODE_LENGTH} karakter · 0/O ve 1/I yok
                </p>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-slate-500">
                    Kullanılan Kota / Öğrenci
                  </dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-slate-100">
                    {quotaLabel(org)}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                  <dt className="text-xs text-slate-500">Şube · Yetkili</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-slate-100">
                    {org.branchCount} · {org.memberCount}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openBranchModal(org)}
                  disabled={pending}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                >
                  Şube Ekle
                </button>
                <button
                  type="button"
                  onClick={() => openMemberModal(org)}
                  disabled={pending}
                  className="flex items-center gap-1 rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
                >
                  <UserPlus className="size-3.5" />
                  Yetkili Ata
                </button>
                <button
                  type="button"
                  onClick={() => toggleOrgDetails(org.id)}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
                >
                  <ChevronDown
                    className={`size-3.5 transition ${isExpanded ? 'rotate-180' : ''}`}
                  />
                  {isExpanded ? 'Detayları Gizle' : 'Detayları Göster'}
                </button>
              </div>

              {isExpanded ? (
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <div>
                    <h4 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      Şubeler
                    </h4>
                    {orgBranches.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Kayıtlı şube yok.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {orgBranches.map((branch) => (
                          <li
                            key={branch.id}
                            className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2"
                          >
                            {editingBranchId === branch.id ? (
                              <div className="flex flex-wrap items-end gap-2">
                                <input
                                  value={branchEditForm.name}
                                  onChange={(e) =>
                                    setBranchEditForm((s) => ({
                                      ...s,
                                      name: e.target.value,
                                    }))
                                  }
                                  className="min-w-[120px] flex-1 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                />
                                <input
                                  value={branchEditForm.city}
                                  placeholder="Şehir"
                                  onChange={(e) =>
                                    setBranchEditForm((s) => ({
                                      ...s,
                                      city: e.target.value,
                                    }))
                                  }
                                  className="w-28 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                                />
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() =>
                                    handleSaveBranchEdit(org.id, branch.id)
                                  }
                                  className="rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                                >
                                  Kaydet
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBranchId(null)}
                                  className="text-xs text-slate-500"
                                >
                                  İptal
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm text-slate-200">
                                  {branch.name}
                                  <span className="ml-2 text-xs text-slate-500">
                                    {branch.city ?? 'Şehir belirtilmemiş'}
                                  </span>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => startBranchEdit(branch)}
                                    className="rounded-md border border-white/10 p-1.5 text-slate-400 hover:text-white"
                                    title="Adı düzenle"
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() =>
                                      handleRemoveBranch(org.id, branch.id)
                                    }
                                    className="rounded-md border border-rose-400/30 p-1.5 text-rose-300 hover:bg-rose-500/10"
                                    title="Şubeyi kaldır"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      Yetkililer
                    </h4>
                    {orgMembers.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Atanmış yetkili yok.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {orgMembers.map((member) => (
                          <li
                            key={member.id}
                            className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm"
                          >
                            <p className="font-medium text-slate-100">
                              {member.fullName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {member.email} · Rol:{' '}
                              {orgRoleLabel(member.orgRole)} · Şube:{' '}
                              {member.branchName ?? 'Kurum geneli'}
                              {!member.isActive ? ' · Pasif' : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </article>
            );
          })}
        </div>
        </div>
      )}

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>

            {actionError ? (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            ) : null}

            {modal === 'org' ? (
              <>
                <h3 className="text-lg font-semibold text-slate-100">
                  Yeni Kurum Ekle
                </h3>
                <form onSubmit={handleCreateOrgSubmit} className="mt-4 space-y-4">
                  <label className="block text-sm">
                    <span className="text-slate-400">Kurum Adı</span>
                    <input
                      required
                      minLength={2}
                      value={orgForm.name}
                      onChange={(e) =>
                        setOrgForm((s) => ({ ...s, name: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-400">Lisans Tipi</span>
                    <select
                      value={orgForm.license_type}
                      onChange={(e) =>
                        setOrgForm((s) => ({
                          ...s,
                          license_type: e.target.value as LicenseType,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    >
                      <option value="standard">Standart</option>
                      <option value="pilot">Pilot</option>
                      <option value="enterprise">Kurumsal</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-400">Öğrenci Kotası</span>
                    <input
                      type="number"
                      min={1}
                      required
                      value={orgForm.student_quota}
                      onChange={(e) =>
                        setOrgForm((s) => ({
                          ...s,
                          student_quota: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-400">Bitiş Tarihi (opsiyonel)</span>
                    <input
                      type="date"
                      value={orgForm.valid_until}
                      onChange={(e) =>
                        setOrgForm((s) => ({
                          ...s,
                          valid_until: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Kurumu Kaydet
                  </button>
                </form>
              </>
            ) : null}

            {modal === 'branch' && targetOrg ? (
              <>
                <h3 className="text-lg font-semibold text-slate-100">
                  Şube Ekle — {targetOrg.name}
                </h3>
                <form
                  onSubmit={handleCreateBranchSubmit}
                  className="mt-4 space-y-4"
                >
                  <label className="block text-sm">
                    <span className="text-slate-400">Şube / Kampüs Adı</span>
                    <input
                      required
                      minLength={2}
                      value={branchForm.name}
                      onChange={(e) =>
                        setBranchForm((s) => ({ ...s, name: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-400">Şehir (opsiyonel)</span>
                    <input
                      value={branchForm.city}
                      onChange={(e) =>
                        setBranchForm((s) => ({ ...s, city: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Şubeyi Kaydet
                  </button>
                </form>
              </>
            ) : null}

            {modal === 'member' && targetOrg ? (
              <>
                <h3 className="text-lg font-semibold text-slate-100">
                  Yetkili Ata — {targetOrg.name}
                </h3>
                <form
                  onSubmit={handleAssignMemberSubmit}
                  className="mt-4 space-y-4"
                >
                  <label className="block text-sm">
                    <span className="text-slate-400">Kullanıcı</span>
                    <select
                      required
                      value={memberForm.userId}
                      onChange={(e) =>
                        setMemberForm((s) => ({
                          ...s,
                          userId: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    >
                      <option value="">Seç…</option>
                      {assignableUsers.map((user: B2BAssignableUser) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} ({user.role}) — {user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-400">Şube (opsiyonel)</span>
                    <select
                      value={memberForm.branchId}
                      onChange={(e) =>
                        setMemberForm((s) => ({
                          ...s,
                          branchId: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    >
                      <option value="">Kurum geneli</option>
                      {branchOptions.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                          {branch.city ? ` · ${branch.city}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-400">Kurum Rolü</span>
                    <select
                      value={memberForm.orgRole}
                      onChange={(e) =>
                        setMemberForm((s) => ({
                          ...s,
                          orgRole: e.target.value as OrgRole,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-indigo-400/50"
                    >
                      {(Object.keys(ORG_ROLE_LABELS) as OrgRole[]).map(
                        (role) => (
                          <option key={role} value={role}>
                            {ORG_ROLE_LABELS[role]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Atamayı Kaydet
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
