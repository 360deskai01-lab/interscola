import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Globe2,
  GraduationCap,
  LineChart,
  Radar,
  Sparkles,
  Target,
  Users,
  Wand2,
} from 'lucide-react';

import type { SolutionTabId } from '@/lib/solutions/solution-tabs';

export type SolutionBenefit = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type SolutionTabContent = {
  id: SolutionTabId;
  label: string;
  bannerGradient: string;
  title: string;
  subtitle: string;
  methodology: string;
  benefits: SolutionBenefit[];
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

const CORPORATE_CONTACT = '/contact';

export const SOLUTION_TABS: SolutionTabContent[] = [
  {
    id: 'ogrenci',
    label: 'Öğrenci',
    bannerGradient: 'from-indigo-600/40 via-violet-600/20 to-slate-950',
    title: 'Bireysel öğrenme ve ölçülebilir ilerleme',
    subtitle: 'Adaptif pratik, AI karne ve hedef üniversite barajı — tek panelde.',
    methodology:
      'Interscola, Digital SAT, IELTS Academic ve CAIE A-Level için ayrı sınav motorları sunar; teşhis testi ile zayıf konuları belirler, adaptif havuzdan kişisel setler üretir. Kariyer pusulası ve üniversite eşleşmesi aynı profil omurgasına bağlanır.',
    benefits: [
      {
        icon: Sparkles,
        title: 'Adaptif soru havuzu',
        description: 'Performansa göre zorluk ve konu dağılımı ayarlanır.',
      },
      {
        icon: Wand2,
        title: 'AI rubrik karne',
        description: 'Band ve AO ölçeklerine yakın anlık geri bildirim.',
      },
      {
        icon: Target,
        title: 'Zayıf konu tespiti',
        description: 'Deneme sonrası odaklanılacak konu ve beceri haritası.',
      },
      {
        icon: GraduationCap,
        title: 'Kariyer & kabul köprüsü',
        description: 'Pusula sonuçları hedef okul barajlarıyla yan yana.',
      },
    ],
    ctaLabel: 'Ücretsiz öğrenci hesabı oluştur',
    ctaHref: '/auth/register?next=%2Fstudent%2Fdashboard',
  },
  {
    id: 'ogretmen',
    label: 'Öğretmen',
    bannerGradient: 'from-cyan-600/35 via-indigo-600/15 to-slate-950',
    title: 'Sınıf yönetimi ve pedagojik denetim',
    subtitle: 'Ödev, kütüphane ve öğrenci radarı — Cambridge/SAT odaklı.',
    methodology:
      'Öğretmenler kütüphane materyali atar, sınav sentezler ve tamamlanan denemeleri rubrik detayıyla inceler. Bağlı öğrencilerin kariyer pusulası özeti ve analitik panosu tek modalda sunulur; yetki sunucu kapısında doğrulanır.',
    benefits: [
      {
        icon: BookOpen,
        title: 'Cambridge / SAT ödev atama',
        description: 'Materyal ve deneme atamaları öğrenci paneline düşer.',
      },
      {
        icon: Wand2,
        title: 'Sınav sentezi',
        description: 'Kütüphane içeriğinden hedefe yönelik deneme üretimi.',
      },
      {
        icon: Radar,
        title: 'Öğrenci takip radarı',
        description: 'RIASEC, yetkinlik ve sınav ilerlemesi özet görünümü.',
      },
      {
        icon: LineChart,
        title: 'Analitik özet',
        description: 'Atama tamamlanma ve skor trendleri.',
      },
    ],
    ctaLabel: 'Öğretmen olarak kayıt ol',
    ctaHref: '/auth/register?next=%2Fteacher%2Fdashboard',
  },
  {
    id: 'kurum',
    label: 'Kurum',
    bannerGradient: 'from-fuchsia-600/30 via-indigo-600/20 to-slate-950',
    title: 'Okul ve kurs merkezi lisanslama',
    subtitle: 'Şube, öğretmen ve toplu başarı görünürlüğü.',
    methodology:
      'Kurum yöneticileri organizasyon ve şube hiyerarşisini yönetir; öğretmen davet kodları ve üye rolleri tek admin akışında. Toplu başarı grafikleri ve denetim modülleri kurumsal panelden izlenir (genişletme fazlarıyla).',
    benefits: [
      {
        icon: Building2,
        title: 'Okul / kurs lisanslama',
        description: 'Kampüs ve şube bazlı erişim modeli.',
      },
      {
        icon: Users,
        title: 'Öğretmen koordinasyonu',
        description: 'Davet, rol ve bağlantı yönetimi.',
      },
      {
        icon: BarChart3,
        title: 'Başarı grafikleri',
        description: 'Kurumsal özet ve karşılaştırmalı radar (yol haritası).',
      },
      {
        icon: Award,
        title: 'Ortak kütüphane',
        description: 'Merkezi materyal havuzu ve atama politikaları.',
      },
    ],
    ctaLabel: 'Kurumsal demo talep et',
    ctaHref: CORPORATE_CONTACT,
  },
  {
    id: 'universite',
    label: 'Üniversite',
    bannerGradient: 'from-sky-600/35 via-indigo-600/15 to-slate-950',
    title: 'Kabul barajı ve öğrenci eşleşmesi',
    subtitle: 'Yayınlanmış min SAT/IELTS/A-Level verisi ile profil uyumu.',
    methodology:
      'Üniversite rehberi modülü hedef okulların kabul eşiklerini listeler; öğrenci skorları ve kariyer profili bu baremlerle karşılaştırılır. Keşif sayfası filtreleme, sıralama ve detay slug rotaları ile sunulur.',
    benefits: [
      {
        icon: Globe2,
        title: 'Kabul barajı entegrasyonu',
        description: 'Min SAT, IELTS bandı ve A-Level alanları rehberde.',
      },
      {
        icon: Target,
        title: 'Eşleşme motoru',
        description: 'Skor açığı ve uyum rozetleri öğrenci panelinde.',
      },
      {
        icon: Building2,
        title: 'Yayınlanmış profiller',
        description: 'CMS ile yönetilen üniversite vitrin sayfaları.',
      },
      {
        icon: Sparkles,
        title: 'Öne çıkan okullar',
        description: 'Ana sayfa ve keşif vitrininde öne çıkarma.',
      },
    ],
    ctaLabel: 'Üniversite rehberini keşfet',
    ctaHref: '/universities',
    secondaryCtaLabel: 'Aylık bütçene göre şehir keşfet',
    secondaryCtaHref: '/test-et/budget',
  },
  {
    id: 'burs',
    label: 'Burs & Destek',
    bannerGradient: 'from-emerald-600/30 via-teal-600/15 to-slate-950',
    title: 'Uluslararası fonlama ve yetkinlik uyumu',
    subtitle: 'DSU, hükümet bursları ve profil kriterleri (yol haritası).',
    methodology:
      'Burs ve destek modülü, akademik skorlar, kariyer pusulası çıktıları ve hedef ülke kriterlerini bir arada değerlendirmeyi hedefler. DSU ve benzeri fonlama programları için kontrol listeleri ve uygunluk özeti planlanmıştır.',
    benefits: [
      {
        icon: Award,
        title: 'Fonlama kriterleri',
        description: 'Ülke ve program bazlı eşik özeti.',
      },
      {
        icon: LineChart,
        title: 'Başarı eşikleri',
        description: 'Skor ve yetkinlik profili ile uyum göstergesi.',
      },
      {
        icon: GraduationCap,
        title: 'Yetkinlik uyumu',
        description: 'Kariyer pusulası ve sınav profili birleşik görünüm.',
      },
      {
        icon: Users,
        title: 'Veli & danışman paylaşımı',
        description: 'Rapor export ve paylaşım (genişletme fazı).',
      },
    ],
    ctaLabel: '2 Dakikada Burs İhtimalini Hesapla',
    ctaHref: '/test-et/scholarship',
  },
];

export function getSolutionTabContent(id: SolutionTabId): SolutionTabContent {
  return SOLUTION_TABS.find((tab) => tab.id === id) ?? SOLUTION_TABS[0]!;
}
