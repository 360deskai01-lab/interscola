'use client';

import {
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import {
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Shuffle,
  X,
} from 'lucide-react';
import { adminResetUserPasswordAction } from '@/app/admin/actions';

export interface AdminResetPasswordUser {
  id: string;
  email: string;
  full_name: string;
}

interface AdminResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminResetPasswordUser | null;
}

const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SPECIAL = '!@#$%&*?_-';

function pickRandom(charset: string): string {
  const index = crypto.getRandomValues(new Uint32Array(1))[0]! % charset.length;
  return charset.charAt(index);
}

/** 8–10 karakter; harf, rakam ve en az bir özel karakter. */
export function generateAdminRandomPassword(): string {
  const length = 8 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 3);
  const required = [
    pickRandom(LOWER),
    pickRandom(UPPER),
    pickRandom(DIGITS),
    pickRandom(SPECIAL),
  ];
  const pool = LOWER + UPPER + DIGITS + SPECIAL;
  while (required.length < length) {
    required.push(pickRandom(pool));
  }
  for (let i = required.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
    [required[i], required[j]] = [required[j]!, required[i]!];
  }
  return required.join('');
}

export function AdminResetPasswordModal({
  isOpen,
  onClose,
  user,
}: AdminResetPasswordModalProps): ReactNode {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
    setShowPassword(false);
    setError(null);
    setSuccessMessage(null);
    setCopied(false);
  }, [isOpen, user?.id]);

  if (!isOpen || !user) return null;

  function handleGenerate() {
    setError(null);
    setSuccessMessage(null);
    setCopied(false);
    setPassword(generateAdminRandomPassword());
    setShowPassword(true);
  }

  async function copyPassword() {
    if (!password.trim()) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Panoya kopyalanamadı. Şifreyi elle kopyalayın.');
    }
  }

  function handleSubmit() {
    if (!user) return;
    setError(null);
    setSuccessMessage(null);
    setCopied(false);

    const targetUserId = user.id;

    startTransition(async () => {
      try {
        const result = await adminResetUserPasswordAction(
          targetUserId,
          password,
        );
        if (!result.success) {
          setError(result.error ?? 'Şifre güncellenemedi.');
          return;
        }
        setSuccessMessage(
          result.message ?? 'Kullanıcı şifresi başarıyla güncellendi.',
        );
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Beklenmeyen bir hata.',
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-reset-password-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 text-amber-200">
              <KeyRound className="size-5" aria-hidden />
            </span>
            <div>
              <h2
                id="admin-reset-password-title"
                className="text-lg font-semibold text-slate-50"
              >
                Şifre Sıfırla
              </h2>
              <p className="mt-0.5 text-sm text-slate-400">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            aria-label="Kapat"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-300">
          <span className="font-medium text-slate-100">
            {user.full_name || '—'}
          </span>{' '}
          için yeni giriş şifresi belirleyin.
        </p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Yeni şifre
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-sm text-slate-100 outline-none ring-amber-400/40 focus:ring-2"
                placeholder="En az 6 karakter"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={pending}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-400/35 bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-60"
            >
              <Shuffle className="size-3.5" />
              Rastgele
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <p>{successMessage}</p>
              <button
                type="button"
                onClick={() => void copyPassword()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/25"
              >
                <Copy className="size-3.5" />
                {copied ? 'Kopyalandı' : 'Şifreyi panoya kopyala'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
          >
            {successMessage ? 'Kapat' : 'İptal'}
          </button>
          {!successMessage ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || password.trim().length < 6}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {pending ? 'Güncelleniyor…' : 'Şifreyi Güncelle'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
