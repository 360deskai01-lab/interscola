export interface NavLinkItem {
  label: string;
  href: string;
  description?: string;
  badge?: string;
}

export const NAV_INTERSCOLA_HREF = '/#interscola';
export const NAV_SYSTEM_HREF = '/#system';
export const NAV_PRICING_HREF = '/#pricing';
export const NAV_HELP_HREF = '/#yardim';

export const SOLUTIONS_LINKS: NavLinkItem[] = [
  {
    label: 'Öğrenci',
    href: '/auth/register',
    description: 'Bireysel çalışma ve teşhis testleri',
  },
  {
    label: 'Eğitmen',
    href: '/auth/register',
    description: 'Kütüphane yönetimi ve öğrenci takip araçları',
  },
  {
    label: 'Veli',
    href: '/#cozumler-veli',
    description: 'Gelişim grafiği ve hedef baraj raporları',
  },
  {
    label: 'Kurum',
    href: '/#cozumler-kurum',
    description: 'Okul ve şube lisanslama modeli',
  },
];

export const TEST_LINKS: NavLinkItem[] = [
  { label: 'Digital SAT', href: '/' },
  { label: 'IELTS Academic', href: '/' },
  {
    label: 'Cambridge CAIE A-Level',
    href: '/student/dashboard?tab=explore',
  },
  {
    label: 'Yetkinlik Envanteri',
    href: '/#yetkinlik-envanteri',
    badge: 'Beta',
  },
];

export const PRIMARY_NAV_LINKS: NavLinkItem[] = [
  { label: 'Paketler', href: NAV_PRICING_HREF },
  { label: 'Üniversiteler', href: '/universities' },
  { label: 'Yardım', href: NAV_HELP_HREF },
];
