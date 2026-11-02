'use client';

import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import type { ReactNode } from 'react';

type MemberRole = 'admin' | 'teacher' | 'student';

interface HomeMemberWelcomeProps {
  email: string | null;
  role: MemberRole;
  status: string | null;
}

function displayName(email: string | null): string {
  if (!email?.trim()) return 'Interscola öğrencisi';
  const local = email.split('@')[0]?.trim();
  if (!local) return 'Interscola öğrencisi';
  const first = local.split(/[._-]/)[0];
  if (!first) return local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function portalForRole(role: MemberRole): { href: string; label: string } {
  if (role === 'teacher') {
    return { href: '/teacher/dashboard', label: 'Eğitmen Portalı\'na Git' };
  }
  if (role === 'admin') {
    return { href: '/admin/dashboard', label: 'Yönetim Paneline Git' };
  }
  return { href: '/student/dashboard', label: 'Öğrenci Portalı\'na Git' };
}

export function HomeMemberWelcome({
  email,
  role,
  status,
}: HomeMemberWelcomeProps): ReactNode {
  const portal = portalForRole(role);
  const approved = status === 'approved';
  const name = displayName(email);

  return (
    <div className="mb-10 rounded-2xl border border-sky-400/25 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-violet-500/10 p-6 sm:p-8">
      {approved ? (
        <>
          <p className="text-xs font-medium uppercase tracking-wider text-sky-200/90">
            Tekrar hoş geldin
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Hoş geldin {name}, çalışmalarına devam et
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Teşhis, açık sınav havuzu ve üniversite kabul eşleştirmesi seni
            portaldan bekliyor.
          </p>
          <Link
            href={portal.href}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/15 px-5 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25"
          >
            {portal.label}
            <ArrowRight className="size-4" />
          </Link>
        </>
      ) : (
        <>
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-100">
            <Clock className="size-3.5" />
            Onay Bekleniyor
          </p>
          <h1 className="mt-3 text-xl font-semibold text-slate-100">
            Merhaba {name}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-slate-400">
            Hesabın yönetici onayından sonra öğrenci portalı ve teşhis
            sınavlarına tam erişim açılacak.
          </p>
        </>
      )}
    </div>
  );
}
