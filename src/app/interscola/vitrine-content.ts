import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Award,
  Brain,
  Building2,
  Compass,
  Cpu,
  Globe2,
  GraduationCap,
  HeartHandshake,
  LineChart,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';

export type VitrineCard = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const SCIENCE_APPROACH_CARDS: VitrineCard[] = [
  {
    icon: Target,
    title: 'Öğrenci Yetkinliği',
    description:
      'Bilişsel teşhis ve kariyer pusulası ile güçlü yönleri ölçer, gelişim alanlarını netleştirir.',
  },
  {
    icon: ShieldCheck,
    title: 'Kabul Şartları Uygunluğu',
    description:
      'Hedef üniversite barajlarıyla skorları eşleştirir; eksikleri görünür kılar.',
  },
  {
    icon: Cpu,
    title: 'Adaptif Soru Motoru',
    description:
      'Digital SAT, IELTS ve CAIE için ayrı motorlar; zorluk seviyesi performansa göre ayarlanır.',
  },
  {
    icon: Award,
    title: 'Uluslararası Değerlendirme Standardı',
    description:
      'Resmî sınav mantığına yakın rubrik ve band ölçekleriyle tutarlı geri bildirim.',
  },
  {
    icon: LineChart,
    title: 'Anlık Analiz Motoru',
    description:
      'Deneme sonrası anında karne, konu kırılımı ve öğretmen panosuna yansıyan özetler.',
  },
];

export const AI_CAPABILITY_ICONS: VitrineCard[] = [
  {
    icon: ScanSearch,
    title: 'Rubrik Puanlama',
    description: 'IELTS, Cambridge AO ve SAT ölçeklerine hizalı otomatik puanlama.',
  },
  {
    icon: Brain,
    title: 'Semantik Hata Tespiti',
    description: 'Açık uçlu yanıtlarda anlam ve yapı hatalarını ayırt eder.',
  },
  {
    icon: Sparkles,
    title: 'Çoklu Modül',
    description: 'Sınav, kariyer, üniversite ve kurumsal paneller tek veri omurgasında.',
  },
  {
    icon: Activity,
    title: 'Öngörücü Kabul Skoru',
    description: 'Trend ve hedef okul baremine göre olasılıksal uyum göstergesi.',
  },
];

export const EXAM_ENGINE_CARDS = [
  {
    icon: Globe2,
    badge: 'Akademik İngilizce',
    title: 'IELTS Academic',
    description:
      'Band odaklı okuma, dinleme, yazma ve konuşma modülleri; rubrik geri bildirimi.',
  },
  {
    icon: GraduationCap,
    badge: 'A-Level',
    title: 'Cambridge CAIE A-Level',
    description:
      'AO1/AO2/AO3 rubrik denetimi ve konu bazlı derinlemesine değerlendirme.',
  },
  {
    icon: Zap,
    badge: 'College Board',
    title: 'Digital SAT',
    description:
      'Adaptif bölüm mantığına uygun pratik ve skor projeksiyonu.',
  },
] as const;

export const VIEW_360_CARDS: VitrineCard[] = [
  {
    icon: Compass,
    title: 'Hazırlık',
    description: 'Teşhis, plan ve kişisel çalışma yolu.',
  },
  {
    icon: Cpu,
    title: 'Sınav',
    description: 'Resmî formata yakın deneme deneyimi.',
  },
  {
    icon: LineChart,
    title: 'Değerlendirme',
    description: 'Anlık karne ve rubrik detayı.',
  },
  {
    icon: Building2,
    title: 'Üniversiteler',
    description: 'Kabul barajları ve keşif rehberi.',
  },
  {
    icon: HeartHandshake,
    title: 'Yaşam',
    description: 'Şehir, konaklama ve maliyet ipuçları.',
  },
  {
    icon: Award,
    title: 'Burs & Destek',
    description: 'Profil uygunluğu ve fonlama kriterleri.',
  },
];

export const ECOSYSTEM_CARDS: VitrineCard[] = [
  {
    icon: Building2,
    title: 'Kurum',
    description: 'Okul ve şube lisanslama, toplu başarı görünürlüğü.',
  },
  {
    icon: Users,
    title: 'Öğretmen',
    description: 'Atama, kütüphane ve öğrenci analitiği.',
  },
  {
    icon: GraduationCap,
    title: 'Öğrenci',
    description: 'Panel, pusula ve hedef üniversite takibi.',
  },
  {
    icon: HeartHandshake,
    title: 'Ebeveyn',
    description: 'Gelişim özeti ve hedef baraj raporları (yol haritası).',
  },
];
