'use client';

import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { updateOrganizationQuotasAction } from '@/app/coordinator/coordinator-actions';

export interface CoordinatorQuotaEditorModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName: string;
  initialStudentQuota: number | null;
  initialTeacherQuota: number;
}

export function CoordinatorQuotaEditorModal({
  open,
  onClose,
  organizationId,
  organizationName,
  initialStudentQuota,
  initialTeacherQuota,
}: CoordinatorQuotaEditorModalProps): ReactNode {
  const router = useRouter();
  const [studentQuota, setStudentQuota] = useState(
    initialStudentQuota !== null ? String(initialStudentQuota) : '',
  );
  const [teacherQuota, setTeacherQuota] = useState(String(initialTeacherQuota));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setStudentQuota(
      initialStudentQuota !== null ? String(initialStudentQuota) : '',
    );
    setTeacherQuota(String(initialTeacherQuota));
    setError(null);
    setNotice(null);
  }, [open, initialStudentQuota, initialTeacherQuota]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit() {
    setError(null);
    setNotice(null);
    const parsedStudent =
      studentQuota.trim() === '' ? null : Number(studentQuota);
    const parsedTeacher = Number(teacherQuota);

    if (
      parsedStudent !== null &&
      (!Number.isFinite(parsedStudent) || parsedStudent < 0)
    ) {
      setError('Öğrenci kotası geçerli bir sayı olmalıdır.');
      return;
    }
    if (!Number.isFinite(parsedTeacher) || parsedTeacher < 1) {
      setError('Öğretmen kotası en az 1 olmalıdır.');
      return;
    }

    startTransition(async () => {
      const result = await updateOrganizationQuotasAction({
        organizationId,
        studentQuota: parsedStudent,
        teacherQuota: parsedTeacher,
      });
      if (!result.success) {
        setError(result.error ?? 'Kayıt başarısız.');
        return;
      }
      setNotice(result.warning ?? 'Kotalar güncellendi.');
      router.refresh();
      window.setTimeout(() => onClose(), 800);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coordinator-quota-editor-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="coordinator-quota-editor-title"
              className="text-lg font-semibold text-white"
            >
              Kotaları güncelle
            </h2>
            <p className="mt-1 text-sm text-slate-400">{organizationName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Öğrenci kotası
            </span>
            <input
              type="number"
              min={0}
              value={studentQuota}
              onChange={(e) => setStudentQuota(e.target.value)}
              placeholder="Sınırsız için boş bırakın"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none ring-indigo-400/40 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Öğretmen kotası
            </span>
            <input
              type="number"
              min={1}
              value={teacherQuota}
              onChange={(e) => setTeacherQuota(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none ring-indigo-400/40 focus:ring-2"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-4 text-sm text-emerald-300">
            {notice}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-500/25 px-4 py-2 text-sm font-medium text-indigo-50 hover:bg-indigo-500/35 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
