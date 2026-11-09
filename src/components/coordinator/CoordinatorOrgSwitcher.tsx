'use client';

import { Building2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useId, useState, type ReactNode } from 'react';
import type { CoordinatorAdminOrganizationOption } from '@/app/coordinator/coordinator-dashboard-types';
import { CoordinatorQuotaEditorModal } from '@/components/coordinator/CoordinatorQuotaEditorModal';

export interface CoordinatorOrgSwitcherProps {
  organizations: CoordinatorAdminOrganizationOption[];
  selectedOrganizationId: string;
  organizationName: string;
  studentQuota: number | null;
  teacherQuota: number;
}

export function CoordinatorOrgSwitcher({
  organizations,
  selectedOrganizationId,
  organizationName,
  studentQuota,
  teacherQuota,
}: CoordinatorOrgSwitcherProps): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const labelId = useId();
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);

  const onChange = useCallback(
    (nextId: string) => {
      if (!nextId || nextId === selectedOrganizationId) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set('orgId', nextId);
      router.push(`/coordinator?${params.toString()}`);
      router.refresh();
    },
    [router, searchParams, selectedOrganizationId],
  );

  if (organizations.length === 0) {
    return (
      <p className="text-sm text-amber-200/90">
        Aktif kurum bulunamadı. B2B kurumlarını admin panelinden kontrol edin.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col items-stretch justify-between gap-3 overflow-hidden rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:p-4">
        <p
          id={labelId}
          className="flex shrink-0 items-center gap-2 text-sm font-medium text-amber-50"
        >
          <Building2 className="size-4 shrink-0" aria-hidden />
          Kurum görünümü (platform admin)
        </p>
        <div className="flex max-w-full min-w-0 items-center gap-2.5 sm:shrink-0">
          <label className="block min-w-0 flex-1 sm:min-w-[min(100%,16rem)] sm:flex-initial">
            <span className="sr-only">Kurum seçin</span>
            <select
              aria-labelledby={labelId}
              value={selectedOrganizationId}
              onChange={(event) => onChange(event.target.value)}
              className="h-10 w-full min-w-0 rounded-lg border border-white/15 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 outline-none ring-indigo-400/40 focus:ring-2"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setQuotaModalOpen(true)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-300/35 bg-amber-500/20 px-3.5 py-2 text-sm font-medium text-amber-50 hover:bg-amber-500/30"
          >
            <span aria-hidden>⚙️</span>
            Kotaları güncelle
          </button>
        </div>
      </div>

      <CoordinatorQuotaEditorModal
        open={quotaModalOpen}
        onClose={() => setQuotaModalOpen(false)}
        organizationId={selectedOrganizationId}
        organizationName={organizationName}
        initialStudentQuota={studentQuota}
        initialTeacherQuota={teacherQuota}
      />
    </>
  );
}
