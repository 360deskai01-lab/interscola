import type { RiasecCode } from '@/types/assessment';

export interface SampleMajorSuggestion {
  title: string;
  rationale: string;
}

const MAJORS_BY_LETTER: Record<RiasecCode, SampleMajorSuggestion[]> = {
  R: [
    {
      title: 'Makine / İnşaat Mühendisliği',
      rationale: 'Politecnico di Milano gibi teknik odaklı programlarla uyumlu.',
    },
    {
      title: 'Endüstriyel Tasarım',
      rationale: 'Uygulamalı proje ve atölye odaklı müfredatlar.',
    },
  ],
  I: [
    {
      title: 'Ekonomi & Finans',
      rationale: 'Bocconi tarzı analitik ve veri odaklı lisans profiline yakın.',
    },
    {
      title: 'Bilgisayar Bilimleri',
      rationale: 'Araştırma ve problem çözme ağırlıklı STEM rotası.',
    },
  ],
  A: [
    {
      title: 'İletişim & Medya',
      rationale: 'Yaratıcı portfolyo ve sunum becerisi gerektiren bölümler.',
    },
    {
      title: 'Mimarlık',
      rationale: 'Estetik ve tasarım odaklı disiplinler arası alan.',
    },
  ],
  S: [
    {
      title: 'Uluslararası İlişkiler',
      rationale: 'Sosyal etki ve çok kültürlü iş birliği gerektiren programlar.',
    },
    {
      title: 'Eğitim Bilimleri',
      rationale: 'Rehberlik ve öğrenme psikolojisi odaklı rotalar.',
    },
  ],
  E: [
    {
      title: 'İşletme (Management)',
      rationale: 'Liderlik, girişimcilik ve organizasyon becerileri.',
    },
    {
      title: 'Politika & Kamu Yönetimi',
      rationale: 'Etkileme ve stratejik karar alma odaklı alanlar.',
    },
  ],
  C: [
    {
      title: 'Muhasebe & Denetim',
      rationale: 'Düzen, standart ve süreç odaklı profesyonel yollar.',
    },
    {
      title: 'Lojistik & Operasyon',
      rationale: 'Planlama ve operasyonel mükemmellik gerektiren bölümler.',
    },
  ],
};

/** Holland kodunun öncelik harflerine göre 2 örnek bölüm önerisi. */
export function suggestSampleMajors(topLetters: RiasecCode[]): SampleMajorSuggestion[] {
  const seen = new Set<string>();
  const out: SampleMajorSuggestion[] = [];

  for (const letter of topLetters) {
    for (const major of MAJORS_BY_LETTER[letter]) {
      if (seen.has(major.title)) continue;
      seen.add(major.title);
      out.push(major);
      if (out.length >= 2) return out;
    }
  }

  return out.length > 0
    ? out
    : MAJORS_BY_LETTER.I.slice(0, 2);
}
