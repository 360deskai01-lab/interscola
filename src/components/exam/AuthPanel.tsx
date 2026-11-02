'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BookOpen,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from 'lucide-react';

export interface SessionUser {
  id: string;
  email: string | null;
}

interface AuthPanelProps {
  user: SessionUser | null;
  /** Kullanıcının profili varsa rolü; yoksa `null`. */
  role?: 'admin' | 'teacher' | 'student' | null;
  /** Profil onay durumu (`approved` ise portal linkleri gösterilir). */
  status?: string | null;
  loading: boolean;
  onSignOut: () => void;
}

/**
 * Header'daki oturum alanı.
 *
 * Giriş/kayıt akışı için ayrı sayfalar henüz yok; bu yüzden butonlar
 * kullanıcıyı bilgilendiren bir bildirim gösterir. Auth sayfaları eklendiğinde
 * `href` değerlerini gerçek rotalara çevirmek yeterli olacak.
 */
export function AuthPanel({
  user,
  role = null,
  status = null,
  loading,
  onSignOut,
}: AuthPanelProps): ReactNode {
  if (loading) {
    return (
      <div className="h-9 w-28 animate-pulse rounded-full bg-white/5" aria-hidden />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/auth/login"
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
        >
          <LogIn className="size-4" />
          Giriş Yap
        </a>
        <a
          href="/auth/register"
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-900/30 transition hover:brightness-110"
        >
          <UserPlus className="size-4" />
          Kayıt Ol
        </a>
      </div>
    );
  }

  const label = user.email ?? 'Kullanıcı';
  const isApproved = status === 'approved';

  return (
    <div className="flex items-center gap-2">
      {role === 'admin' ? (
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3.5 py-1.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/25 hover:text-white"
        >
          <ShieldCheck className="size-4" />
          Yönetim Paneli
        </Link>
      ) : null}

      {role === 'teacher' && isApproved ? (
        <Link
          href="/teacher/dashboard"
          className="flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-3.5 py-1.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/25 hover:text-white"
        >
          <BookOpen className="size-4" />
          Eğitmen Portalı
        </Link>
      ) : null}

      {role === 'student' && isApproved ? (
        <Link
          href="/student/dashboard"
          className="flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-3.5 py-1.5 text-sm font-medium text-sky-200 transition hover:bg-sky-500/25 hover:text-white"
        >
          <Sparkles className="size-4" />
          Öğrenci Portalı
        </Link>
      ) : null}

      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pr-1.5 pl-2.5">
        <UserRound className="size-4 text-indigo-300" />
        <span className="max-w-[160px] truncate text-sm text-slate-200">
          {label}
        </span>
        <motion.button
          type="button"
          onClick={onSignOut}
          whileTap={{ scale: 0.94 }}
          title="Çıkış yap"
          aria-label="Çıkış yap"
          className="grid size-7 place-items-center rounded-full bg-white/5 text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-200"
        >
          <LogOut className="size-3.5" />
        </motion.button>
      </div>
    </div>
  );
}
