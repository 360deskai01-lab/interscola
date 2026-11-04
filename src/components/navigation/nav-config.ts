export interface NavLinkItem {
  label: string;
  href: string;
  description?: string;
  badge?: string;
}

export const NAV_INTERSCOLA_HREF = '/interscola';
export const NAV_SYSTEM_HREF = '/sistem';
export const NAV_PRICING_HREF = '/pricing';
export const NAV_HELP_HREF = '/help';
export const NAV_CONTACT_HREF = '/contact';
export const NAV_CAREER_COMPASS_HREF = '/career-compass';

export const SOLUTIONS_LINKS: NavLinkItem[] = [
  {
    label: 'Öğrenci',
    href: '/solutions?tab=ogrenci',
    description: 'Bireysel çalışma ve teşhis testleri',
  },
  {
    label: 'Eğitmen',
    href: '/solutions?tab=ogretmen',
    description: 'Kütüphane yönetimi ve öğrenci takip araçları',
  },
  {
    label: 'Kurum',
    href: '/solutions?tab=kurum',
    description: 'Okul ve şube lisanslama modeli',
  },
  {
    label: 'Üniversite',
    href: '/solutions?tab=universite',
    description: 'Kabul barajı ve öğrenci eşleşmesi',
  },
  {
    label: 'Burs & Destek',
    href: '/solutions?tab=burs',
    description: 'Fonlama kriterleri ve yetkinlik uyumu',
  },
  {
    label: 'Veli',
    href: '/pricing',
    description: 'Veli paketi ve gelişim raporları',
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
  { label: 'Digital SAT', href: '/sistem' },
  { label: 'IELTS Academic', href: '/sistem' },
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

/** Footer vitrin satırı — navbar Interscola / Sistem ile simetrik. */
export const FOOTER_VITRIN_LINKS: NavLinkItem[] = [
  { label: 'Interscola vitrini', href: NAV_INTERSCOLA_HREF },
  { label: 'Sistem & motorlar', href: NAV_SYSTEM_HREF },
];

/** Footer destek satırı — navbar Paketler / Yardım ile simetrik. */
export const FOOTER_SUPPORT_LINKS: NavLinkItem[] = [
  { label: 'Paketler', href: NAV_PRICING_HREF },
  { label: 'Yardım & SSS', href: NAV_HELP_HREF },
];
