'use client';

import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import type { TeacherOrganizationContext } from '@/app/teacher/actions';
import {
  JOIN_CODE_FIELD_MAX_LENGTH,
  JOIN_CODE_PATTERN,
  formatJoinCodeFieldInput,
  normalizeJoinCodeInput,
  JOIN_CODE_LENGTH,
} from '@/lib/b2b/join-code';

interface TeacherOrganizationJoinCardProps {
  initialOrgContext: TeacherOrganizationContext | null;
  onJoinOrganization: (
    joinCode: string,
  ) => Promise<{ success: boolean; message: string; orgName?: string }>;
}

export function TeacherOrganizationJoinCard({
  initialOrgContext,
  onJoinOrganization,
}: TeacherOrganizationJoinCardProps): ReactNode {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(
    initialOrgContext?.organizationName ?? null,
  );
  const [pending, startTransition] = useTransition();

  function handleJoin() {
    setError(null);
    setSuccess(null);
    const clean = normalizeJoinCodeInput(joinCode);
    if (!JOIN_CODE_PATTERN.test(clean)) {
      setError(
        `Katılım kodu ${JOIN_CODE_LENGTH} karakter olmalıdır (ör. FAV-B82).`,
      );
      return;
    }
    startTransition(async () => {
      const result = await onJoinOrganization(clean);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setSuccess(result.message);
      if (result.orgName) {
        setOrgName(result.orgName);
      }
      setJoinCode('');
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg" aria-hidden>
          🏛️
        </span>
        <h2 className="text-sm font-medium text-violet-50">
          Bir Kuruma / Şubeye Bağlan
        </h2>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Kurum koordinatörünüzden aldığınız 6 haneli katılım kodu ile kurumsal
        öğretmen kadrosuna dahil olun.
      </p>

      {orgName ? (
        <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
          <Building2 className="size-3.5" aria-hidden />
          Aktif kurum: {orgName}
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-200/90">
          Henüz bağlı bir kurumunuz yok. Aşağıdan kod ile katılabilirsiniz.
        </p>
      )}

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2.5 text-sm text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-100"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="text-xs text-slate-500">Katılım kodu</span>
          <input
            type="text"
            value={joinCode}
            autoComplete="off"
            spellCheck={false}
            maxLength={JOIN_CODE_FIELD_MAX_LENGTH}
            onChange={(event) =>
              setJoinCode(
                formatJoinCodeFieldInput(event.target.value).toUpperCase(),
              )
            }
            placeholder="● ● ● ● ● ●"
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 font-mono text-sm tracking-widest text-slate-100 outline-none transition focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/15"
          />
        </label>
        <button
          type="button"
          onClick={handleJoin}
          disabled={pending}
          className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-400/35 bg-violet-500/25 px-5 text-sm font-medium text-violet-50 transition hover:bg-violet-500/35 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Building2 className="size-4" aria-hidden />
          )}
          Kuruma Katıl
        </button>
      </div>
    </div>
  );
}
