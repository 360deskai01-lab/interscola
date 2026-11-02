'use client';

import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  NAV_HELP_HREF,
  NAV_PRICING_HREF,
  TEST_LINKS,
} from '@/components/navigation/nav-config';

const LEGAL_LINKS = [
  { label: 'Gizlilik Politikası', href: '/#gizlilik' },
  { label: 'Kullanım Şartları', href: '/#kullanim-sartlari' },
  { label: 'Çerez Politikası', href: '/#cerez-politikasi' },
  { label: 'İletişim', href: 'mailto:hello@interscola.com' },
] as const;

const SOLUTIONS_FOOTER = [
  { label: 'Öğrenciler', href: '/auth/register' },
  { label: 'Danışmanlar', href: '/auth/register' },
  { label: 'Okul & Kurs Lisansları', href: '/#cozumler-kurum' },
] as const;

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      <div className="mt-4 space-y-2.5 text-sm text-slate-300">{children}</div>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): ReactNode {
  return (
    <Link
      href={href}
      className="block text-slate-400 transition hover:text-sky-300"
    >
      {children}
    </Link>
  );
}

export function Footer(): ReactNode {
  return (
    <footer className="mt-16 border-t border-white/10 pt-12">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <FooterColumn title="Interscola">
          <Link href="/#interscola" className="inline-flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg border border-indigo-400/30 bg-indigo-500/10">
              <GraduationCap className="size-5 text-indigo-200" />
            </span>
            <span className="text-base font-semibold text-slate-100">
              Interscola
            </span>
          </Link>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Uluslararası sınav hazırlığında bilişsel değerlendirme ve üniversite
            kabul eşleştirmesi — tek platform.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
            <span
              className="size-2 rounded-full bg-emerald-400"
              aria-hidden
            />
            Sistem durumu: Operational
          </p>
        </FooterColumn>

        <FooterColumn title="Sınavlar">
          {TEST_LINKS.map((link) => (
            <FooterLink key={link.label} href={link.href}>
              {link.label}
              {link.badge ? (
                <span className="ml-1.5 text-[10px] text-violet-300">
                  {link.badge}
                </span>
              ) : null}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Çözümler">
          {SOLUTIONS_FOOTER.map((link) => (
            <FooterLink key={link.label} href={link.href}>
              {link.label}
            </FooterLink>
          ))}
          <FooterLink href="/#cozumler-veli">Veli</FooterLink>
          <FooterLink href={NAV_PRICING_HREF}>Paketler</FooterLink>
          <FooterLink href={NAV_HELP_HREF}>Yardım & SSS</FooterLink>
        </FooterColumn>

        <FooterColumn title="Kurumsal & Yasal">
          {LEGAL_LINKS.map((link) => (
            <FooterLink key={link.label} href={link.href}>
              {link.label}
            </FooterLink>
          ))}
          <span id="gizlilik" className="sr-only" />
          <span id="kullanim-sartlari" className="sr-only" />
          <span id="cerez-politikasi" className="sr-only" />
        </FooterColumn>
      </div>

      <div
        id="pricing"
        className="sr-only"
        aria-hidden
      />
      <div id="yardim" className="sr-only" aria-hidden />

      <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs leading-relaxed text-slate-600">
        <p>© 2026 Interscola Inc.</p>
        <p className="mx-auto mt-3 max-w-3xl">
          Bağımsızlık feragatı: SAT College Board&apos;un, IELTS British
          Council/IDP&apos;nin tescilli markalarıdır. Platform bu kurumlarla
          doğrudan bağlantılı değildir.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-slate-700">
          Sonuçlar yaklaşık ölçeklerdir; resmî sınav kurumlarının dönüşüm
          tablolarının yerini tutmaz.
        </p>
      </div>
    </footer>
  );
}
