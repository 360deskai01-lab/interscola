'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { NavbarAuthArea } from '@/components/navigation/NavbarAuthArea';
import type { NavbarAuthSnapshot } from '@/components/navigation/nav-auth.types';
import {
  NAV_HELP_HREF,
  NAV_INTERSCOLA_HREF,
  NAV_PRICING_HREF,
  NAV_SYSTEM_HREF,
  PRIMARY_NAV_LINKS,
  SOLUTIONS_LINKS,
  TEST_LINKS,
  type NavLinkItem,
} from '@/components/navigation/nav-config';
import { loginUrlWithNext } from '@/lib/safe-next-path';

interface NavbarProps {
  auth: NavbarAuthSnapshot;
  authLoading?: boolean;
  onClientSignOut?: () => void;
}

function NavDropdown({
  label,
  items,
  align = 'left',
}: {
  label: string;
  items: NavLinkItem[];
  align?: 'left' | 'right';
}): ReactNode {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className={`size-4 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div
          className={`absolute top-full z-50 mt-1 min-w-[240px] rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-xl backdrop-blur-md ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={`${label}-${item.label}`}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 transition hover:bg-white/[0.06]"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-100">
                    {item.label}
                    {item.badge ? (
                      <span className="rounded-md border border-violet-400/40 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {item.description}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MobileNavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavLinkItem[];
  onNavigate: () => void;
}): ReactNode {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={`${title}-${item.label}`}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/[0.06]"
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="text-[10px] font-semibold text-violet-300">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Navbar({
  auth,
  authLoading = false,
  onClientSignOut,
}: NavbarProps): ReactNode {
  const pathname = usePathname() ?? '/';
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const caieExploreHref = loginUrlWithNext(
    '/student/dashboard?tab=explore',
  );
  const testLinksResolved = TEST_LINKS.map((item) =>
    item.label === 'Cambridge CAIE A-Level'
      ? { ...item, href: auth.user ? item.href : caieExploreHref }
      : item,
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400/60"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 shadow-lg shadow-indigo-900/40 transition group-hover:brightness-110">
            <GraduationCap className="size-5 text-white" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-base font-semibold tracking-tight text-slate-50">
              Interscola
            </span>
            <span className="block text-[11px] text-slate-500">
              EdTech · Uluslararası Sınav
            </span>
          </span>
          <span className="rounded-md border border-indigo-400/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200 sm:hidden">
            Akademik
          </span>
        </Link>

        <nav
          aria-label="Platform menüsü"
          className="hidden items-center gap-0.5 lg:flex"
        >
          <Link
            href={NAV_INTERSCOLA_HREF}
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            Interscola
          </Link>
          <Link
            href={NAV_SYSTEM_HREF}
            className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            Sistem
          </Link>
          <NavDropdown label="Çözümler" items={SOLUTIONS_LINKS} />
          <NavDropdown label="Test Et" items={testLinksResolved} align="right" />
          {PRIMARY_NAV_LINKS.map((item) => {
            const active =
              (item.href === '/universities' &&
                (pathname === '/universities' ||
                  pathname.startsWith('/universities/'))) ||
              (item.href === '/career-compass' &&
                pathname.startsWith('/career-compass'));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-100'
                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <NavbarAuthArea
              auth={auth}
              loading={authLoading}
              onClientSignOut={onClientSignOut}
            />
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/[0.06] lg:hidden"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={closeMobile}
          />
          <div className="absolute top-0 right-0 flex h-full w-[min(100%,320px)] flex-col border-l border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-slate-100">Menü</span>
              <button
                type="button"
                onClick={closeMobile}
                className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06]"
                aria-label="Kapat"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              <div className="space-y-1">
                <Link
                  href={NAV_INTERSCOLA_HREF}
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.06]"
                >
                  Interscola
                </Link>
                <Link
                  href={NAV_SYSTEM_HREF}
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.06]"
                >
                  Sistem
                </Link>
                <Link
                  href={NAV_PRICING_HREF}
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.06]"
                >
                  Paketler
                </Link>
                <Link
                  href="/career-compass"
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-violet-200 hover:bg-white/[0.06]"
                >
                  Kariyer Pusulası
                </Link>
                <Link
                  href="/universities"
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.06]"
                >
                  Üniversiteler
                </Link>
                <Link
                  href={NAV_HELP_HREF}
                  onClick={closeMobile}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/[0.06]"
                >
                  Yardım
                </Link>
              </div>
              <MobileNavSection
                title="Çözümler"
                items={SOLUTIONS_LINKS}
                onNavigate={closeMobile}
              />
              <MobileNavSection
                title="Test Et"
                items={testLinksResolved}
                onNavigate={closeMobile}
              />
            </div>
            <div className="border-t border-white/10 p-4 md:hidden">
              <NavbarAuthArea
                auth={auth}
                loading={authLoading}
                onClientSignOut={onClientSignOut}
                compact
              />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
