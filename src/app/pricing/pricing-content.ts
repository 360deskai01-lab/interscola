export type PricingTierId =
  | 'trial'
  | 'student'
  | 'teacher'
  | 'parent'
  | 'school'
  | 'enterprise';

export type PricingCard = {
  id: PricingTierId;
  title: string;
  badge?: string;
  audience: string;
  priceLabel: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
};

const CORPORATE_MAIL = '/contact';

export const PRICING_CARDS: PricingCard[] = [
  {
    id: 'trial',
    title: 'Deneme',
    badge: 'Keşif',
    audience: 'Yeni kullanıcılar',
    priceLabel: '0₺ · 15 gün sınırlı',
    description: 'Platformu risk almadan tanıyın; temel teşhis ve pusula erişimi.',
    features: [
      '15 günlük sınırlı panel erişimi',
      'Hızlı teşhis denemesi',
      'Kariyer pusulası hızlı kombo',
      'Üniversite keşif okuma',
      'Topluluk destek dokümanları',
    ],
    ctaLabel: 'Ücretsiz başla',
    ctaHref: '/auth/register?next=%2Fstudent%2Fdashboard',
  },
  {
    id: 'student',
    title: 'Öğrenci Paketi',
    badge: 'Popüler',
    audience: 'Bireysel aday',
    priceLabel: 'Aylık / yıllık · yakında',
    description: 'Tam sınav simülatörü, AI teşhis ve hedef baraj takibi.',
    features: [
      'Digital SAT, IELTS, CAIE motorları',
      'AI rubrik karne ve zayıf konu haritası',
      'Kariyer pusulası 3 aşama',
      'Hedef üniversite pin & skor açığı',
      'Sınırsız teşhis köprüsü (planlı)',
    ],
    ctaLabel: 'Detaylı incele / Başla',
    ctaHref: '/auth/register?next=%2Fstudent%2Fdashboard',
    highlighted: true,
  },
  {
    id: 'teacher',
    title: 'Öğretmen Paketi',
    audience: 'Eğitmen & danışman',
    priceLabel: 'Aylık / yıllık · yakında',
    description: 'Sınıf yönetimi, sentez ve ödev takibi.',
    features: [
      'Öğrenci bağlantı ve davet kodları',
      'Kütüphane & atama yönetimi',
      'Sınav sentezleme',
      'Kariyer & yetkinlik özeti modalı',
      'Analitik özet panosu',
    ],
    ctaLabel: 'Detaylı incele / Başla',
    ctaHref: '/auth/register?next=%2Fteacher%2Fdashboard',
  },
  {
    id: 'parent',
    title: 'Veli Paketi',
    audience: 'Aile & rehberlik',
    priceLabel: 'Aylık · yakında',
    description: 'Çocuğun gelişimini ve hedef barajı şeffaf takip edin.',
    features: [
      'Anlık gelişim raporları (yol haritası)',
      'Üniversite baraj hedef takibi',
      'Pusula & sınav özeti paylaşımı',
      'Haftalık ilerleme bildirimi (planlı)',
      'Danışman export (planlı)',
    ],
    ctaLabel: 'Detaylı incele',
    ctaHref: '/auth/register?next=%2Fstudent%2Fdashboard',
  },
  {
    id: 'school',
    title: 'Okul Paketi',
    badge: 'Kurumsal',
    audience: 'Tek kampüs',
    priceLabel: 'Kampüs lisansı · teklif',
    description: 'Çoklu zümre, ortak kütüphane ve koordinasyon.',
    features: [
      'Tek kampüs lisansı',
      'Sınırsız öğretmen koltuğu (kota ile)',
      'Ortak materyal havuzu',
      'Kurumsal başarı özeti',
      'Öncelikli destek hattı',
    ],
    ctaLabel: 'Kurumsal iletişim',
    ctaHref: CORPORATE_MAIL,
  },
  {
    id: 'enterprise',
    title: 'Merkez / Zincir Kurum',
    badge: 'Enterprise',
    audience: 'Çoklu şube',
    priceLabel: 'Özel teklif',
    description: 'Üst yönetim radarı, API ve özel entegrasyon.',
    features: [
      'Çoklu şube hiyerarşisi',
      'Üst yönetim istatistik radarı',
      'API / SSO entegrasyonu (yol haritası)',
      'Özel SLA ve onboarding',
      'Veri export & denetim logları',
    ],
    ctaLabel: 'Demo & teklif al',
    ctaHref: CORPORATE_MAIL,
  },
];
