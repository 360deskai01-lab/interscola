'use client';

import Link from 'next/link';
import { LogIn, LogOut, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { signOutAction } from '@/app/auth/sign-out-action';
import type { NavbarAuthSnapshot } from '@/components/navigation/nav-auth.types';

interface NavbarAuthAreaProps {
  auth: NavbarAuthSnapshot;
  loading?: boolean;
  onClientSignOut?: () => void;
  compact?: boolean;
}

function portalLink(auth: NavbarAuthSnapshot): {
  href: string;
  label: string;
} | null {
  if (auth.status !== 'approved' || !auth.role) {
    return null;
  }
  if (auth.role === 'student') {
    return { href: '/student/dashboard', label: '🎓 Öğrenci Portalı' };
  }
  if (auth.role === 'teacher') {
    return { href: '/teacher/dashboard', label: '👨‍🏫 Eğitmen Portalı' };
  }
  if (auth.role === 'admin') {
    return { href: '/admin/dashboard', label: '⚙️ Yönetim Paneli' };
  }
  return null;
}

export function NavbarAuthArea({
  auth,
  loading = false,
  onClientSignOut,
  compact = false,
}: NavbarAuthAreaProps): ReactNode {
  const btnClass = compact
    ? 'w-full justify-center'
    : '';

  if (loading) {
    return (
      <div
        className={`h-9 animate-pulse rounded-full bg-white/5 ${compact ? 'w-full' : 'w-28'}`}
        aria-hidden
      />
    );
  }

  if (!auth.user) {
    return (
      <div
        className={`flex items-center gap-2 ${compact ? 'w-full flex-col' : ''}`}
      >
        <Link
          href="/auth/login"
          className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white ${btnClass}`}
        >
          <LogIn className="size-4 shrink-0" />
          Giriş Yap
        </Link>
        <Link
          href="/auth/register"
          className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:brightness-110 ${btnClass}`}
        >
          <UserPlus className="size-4 shrink-0" />
          Ücretsiz Başla
        </Link>
      </div>
    );
  }

  const portal = portalLink(auth);
  const isPending = auth.status === 'pending';

  return (
    <div
      className={`flex items-center gap-2 ${compact ? 'w-full flex-col' : 'flex-wrap justify-end'}`}
    >
      {isPending ? (
        <span
          className={`inline-flex items-center rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 ${compact ? 'w-full justify-center' : ''}`}
        >
          Onay Bekleniyor
        </span>
      ) : null}

      {portal ? (
        <Link
          href={portal.href}
          className={`inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-3.5 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/25 ${btnClass}`}
        >
          {portal.label}
        </Link>
      ) : null}

      {onClientSignOut ? (
        <button
          type="button"
          onClick={onClientSignOut}
          className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:border-rose-400/30 hover:text-rose-200 ${btnClass}`}
        >
          <LogOut className="size-4 shrink-0" />
          Çıkış
        </button>
      ) : (
        <form action={signOutAction}>
          <button
            type="submit"
            className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:border-rose-400/30 hover:text-rose-200 ${btnClass}`}
          >
            <LogOut className="size-4 shrink-0" />
            Çıkış
          </button>
        </form>
      )}
    </div>
  );
}
