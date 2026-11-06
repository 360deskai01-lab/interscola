'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { LayoutDashboard } from 'lucide-react';

const HUB_LINKS = [
  { href: '/student/goals', label: 'Hedeflerim & Rota', emoji: '🎯' },
  { href: '/student/connections', label: 'Bağlantılarım', emoji: '🤝' },
  { href: '/student/profile', label: 'Akademik Profil', emoji: '🎓' },
  { href: '/student/studio', label: 'AI Sınav Üretici', emoji: '✨', beta: true },
] as const;

interface StudentHubNavProps {
  currentHref: string;
}

export function StudentHubNav({ currentHref }: StudentHubNavProps): ReactNode {
  return (
    <aside className="lg:w-64 lg:shrink-0">
      <nav
        className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 backdrop-blur-sm"
        aria-label="Öğrenci merkezleri"
      >
        <Link
          href="/student/dashboard"
          className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        >
          <LayoutDashboard className="size-4 shrink-0 text-slate-400" />
          Komuta merkezi
        </Link>
        <ul className="space-y-1">
          {HUB_LINKS.map((item) => {
            const active = currentHref === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                    active
                      ? 'border-indigo-400/45 bg-gradient-to-r from-indigo-500/20 to-violet-500/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'border-transparent bg-white/[0.03] text-slate-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-100'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {item.emoji}
                  </span>
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {'beta' in item && item.beta ? (
                    <span className="shrink-0 rounded-md border border-violet-400/40 bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-violet-100">
                      BETA
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
