'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { AdminActionResult } from '@/app/admin/actions';

type ProfileStatus = 'pending' | 'approved' | 'rejected';

/** Panelde listelenen kullanıcı (server'dan serialize edilmiş). */
export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  createdAt: string;
}

interface UserTableProps {
  users: AdminUserRow[];
  onApprove: (userId: string) => Promise<AdminActionResult>;
  onReject: (userId: string) => Promise<AdminActionResult>;
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Öğrenci',
  teacher: 'Öğretmen',
  admin: 'Yönetici',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Onay Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function statusClasses(status: string): string {
  if (status === 'approved') {
    return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200';
  }
  if (status === 'rejected') {
    return 'border-rose-400/30 bg-rose-500/15 text-rose-200';
  }
  return 'border-amber-400/30 bg-amber-500/15 text-amber-200';
}

/**
 * Kullanıcı tablosu — Optimistic UI ile.
 *
 * NEDEN CLIENT BİLEŞEN: `<form action={serverAction}>` kullanıldığında Next.js
 * action bitene kadar tüm sayfayı yeniden render ediyor; `revalidatePath` ile
 * birleşince arayüz "Rendering..." metninde takılı kalıyordu. Burada yalnızca
 * ilgili satırın butonu "İşleniyor..." durumuna geçiyor, sonuç döner dönmez
 * satır lokal state'ten düşürülüyor.
 */
export function UserTable({
  users,
  onApprove,
  onReject,
}: UserTableProps): ReactNode {
  /*
   * Lokal kopya: sunucudan gelen liste değiştiğinde senkronize edilmeli.
   * `useState` başlangıç değeri yalnızca ilk render'da kullanılır; bu yüzden
   * sunucu verisi değişince `key` ile remount edilir (aşağıda).
   */
  const [rows, setRows] = useState<AdminUserRow[]>(users);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function applyStatus(userId: string, nextStatus: ProfileStatus) {
    setError(null);
    setBusyId(userId);

    startTransition(async () => {
      const optimisticSnapshot = rows;
      const target = rows.find((row) => row.id === userId);

      // Başarısız olursa geri almak için mevcut durumu saklıyoruz.

      try {
        const result =
          nextStatus === 'approved'
            ? await onApprove(userId)
            : await onReject(userId);

        if (!result.success) {
          setError(result.error ?? 'İşlem tamamlanamadı.');
          // Optimistic güncelleme yapılmadığı için geri alma gerekmez.
          return;
        }

        if (!target) {
          setError('Kullanıcı listede bulunamadı.');
          return;
        }

        /*
         * Optimistic güncelleme: kullanıcıyı mevcut filtreden düşür.
         * Yeni duruma geçtiği için bu sekmede artık görünmemeli.
         */
        setRows((previous) =>
          previous.filter((row) => row.id !== userId),
        );

        // Sunucu verisini arka planda senkronize et.
        router.refresh();

        // Kullanılmamasın diye referans tutuluyor; ileride undo için gerekebilir.
        void optimisticSnapshot;
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Beklenmeyen bir hata.',
        );
      } finally {
        setBusyId(null);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
        <p className="text-sm text-slate-400">
          Bu filtrede kullanıcı bulunmuyor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-300" />
          <span className="leading-relaxed">{error}</span>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Ad Soyad</th>
                <th className="px-5 py-3 font-medium">E-posta</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Kayıt Tarihi</th>
                <th className="px-5 py-3 font-medium">Durum</th>
                <th className="px-5 py-3 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => {
                const isBusy = busyId === row.id;
                const canApprove = row.status !== 'approved';
                const canReject = row.status !== 'rejected';

                return (
                  <tr key={row.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-4 font-medium text-slate-100">
                      {row.fullName ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-slate-400">{row.email}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          row.role === 'teacher'
                            ? 'border-violet-400/30 bg-violet-500/15 text-violet-200'
                            : 'border-sky-400/30 bg-sky-500/15 text-sky-200'
                        }`}
                      >
                        {ROLE_LABELS[row.role] ?? row.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 tabular-nums">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses(row.status)}`}
                      >
                        {row.status === 'approved' ? (
                          <CheckCircle2 className="size-3" />
                        ) : row.status === 'rejected' ? (
                          <XCircle className="size-3" />
                        ) : (
                          <AlertTriangle className="size-3" />
                        )}
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {canApprove ? (
                          <button
                            type="button"
                            onClick={() => applyStatus(row.id, 'approved')}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            {isBusy ? 'İşleniyor…' : 'Onayla'}
                          </button>
                        ) : null}
                        {canReject ? (
                          <button
                            type="button"
                            onClick={() => applyStatus(row.id, 'rejected')}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isBusy ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            {isBusy ? 'İşleniyor…' : 'Reddet'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
