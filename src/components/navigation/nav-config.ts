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
export const NAV_CAREER_COMPASS_HREF = '/career-compass';

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
  {
    label: 'Kariyer Pusulası',
    href: NAV_CAREER_COMPASS_HREF,
    description: '24 soruluk ücretsiz Hızlı Kombo — üyelik gerekmez',
    badge: 'Yeni',
  },
  {
    label: 'Yetkinlik Envanteri',
    href: NAV_CAREER_COMPASS_HREF,
    description: 'RIASEC, çalışma stili ve bilişsel profil özeti',
    badge: 'Beta',
  },
  { label: 'Digital SAT', href: '/#system' },
  { label: 'IELTS Academic', href: '/#system' },
  {
    label: 'Cambridge CAIE A-Level',
    href: '/student/dashboard?tab=explore',
  },
];

export const PRIMARY_NAV_LINKS: NavLinkItem[] = [
  { label: 'Kariyer Pusulası', href: NAV_CAREER_COMPASS_HREF },
  { label: 'Paketler', href: NAV_PRICING_HREF },
  { label: 'Üniversiteler', href: '/universities' },
  { label: 'Yardım', href: NAV_HELP_HREF },
];
