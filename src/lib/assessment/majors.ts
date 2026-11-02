import type { RiasecCode } from '@/types/assessment';

export interface SampleMajorSuggestion {
  title: string;
  rationale: string;
}

export interface TieredMajorSuggestions {
  primaryMajors: SampleMajorSuggestion[];
  secondaryMajors: SampleMajorSuggestion[];
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

/** İlk iki RIASEC ekseninin kesişimine özel çekirdek bölümler. */
const PRIMARY_BY_PAIR: Record<string, SampleMajorSuggestion[]> = {
  AI: [
    {
      title: 'Mimarlık & Kentsel Tasarım',
      rationale: 'Analitik düşünce ile estetik üretimi birleştiren çekirdek alan.',
    },
    {
      title: 'Endüstriyel Tasarım & İnovasyon',
      rationale: 'Araştırma + yaratıcı prototipleme odaklı disiplinler arası rota.',
    },
    {
      title: 'Bilgisayar Bilimleri (HCI / Grafik)',
      rationale: 'Teknik derinlik ve kullanıcı deneyimi tasarımının kesişimi.',
    },
  ],
  IA: [
    {
      title: 'Veri Bilimi & İstatistik',
      rationale: 'Araştırmacı zihniyet ile düzenli modelleme becerisinin doğal alanı.',
    },
    {
      title: 'Ekonomi & Finans',
      rationale: 'Analitik çekirdek + yapılandırılmış karar süreçleri.',
    },
    {
      title: 'Actuarial Science',
      rationale: 'Matematiksel rigor ve sistematik risk analizi.',
    },
  ],
  IE: [
    {
      title: 'Ekonomi & Finans',
      rationale: 'ISA / IEC profillerinde en sık görülen doğal çekirdek.',
    },
    {
      title: 'Endüstri Mühendisliği',
      rationale: 'Optimizasyon, veri ve operasyonel liderlik bir arada.',
    },
    {
      title: 'Bilgisayar Bilimleri',
      rationale: 'Analitik derinlik + teknoloji odaklı kariyer kapıları.',
    },
  ],
  IS: [
    {
      title: 'Psikoloji & Davranış Bilimleri',
      rationale: 'Araştırma metodolojisi + insan odaklı uygulama.',
    },
    {
      title: 'Halk Sağlığı / Sağlık Yönetimi',
      rationale: 'Veri okuryazarlığı ile toplumsal faydayı birleştiren alan.',
    },
    {
      title: 'Eğitim Teknolojileri',
      rationale: 'Öğrenme bilimi ve analitik içerik tasarımı.',
    },
  ],
  IR: [
    {
      title: 'Makine / Elektrik Mühendisliği',
      rationale: 'Fiziksel sistemler + analitik modelleme.',
    },
    {
      title: 'Bilgisayar Mühendisliği',
      rationale: 'Uygulamalı mühendislik ile araştırma disiplini.',
    },
    {
      title: 'Biyomedikal Mühendislik',
      rationale: 'Laboratuvar + saha uygulaması kesişimi.',
    },
  ],
  EA: [
    {
      title: 'İşletme & Yaratıcı Girişimcilik',
      rationale: 'Pazar stratejisi + marka / ürün hikâyesi.',
    },
    {
      title: 'Pazarlama & Marka Yönetimi',
      rationale: 'Etkileme gücü ile yaratıcı iletişim.',
    },
    {
      title: 'Moda & Lüks Yönetimi',
      rationale: 'Ticari zekâ + estetik sektör dinamikleri.',
    },
  ],
  ES: [
    {
      title: 'Uluslararası İşletme',
      rationale: 'Liderlik, dil ve kültürler arası yönetim.',
    },
    {
      title: 'Kamu Politikası & Siyaset Bilimi',
      rationale: 'Etki alanı geniş, insan odaklı strateji.',
    },
    {
      title: 'Sosyal Girişimcilik',
      rationale: 'Organizasyon becerisi + toplumsal etki.',
    },
  ],
  EC: [
    {
      title: 'Finans & Kontrol',
      rationale: 'Yapılandırılmış süreçler + ticari karar alma.',
    },
    {
      title: 'Supply Chain Management',
      rationale: 'Operasyonel disiplin ve liderlik.',
    },
    {
      title: 'İşletme (Management)',
      rationale: 'Klasik IEC / SEC profilleri için güçlü çekirdek.',
    },
  ],
  SA: [
    {
      title: 'İletişim & Halkla İlişkiler',
      rationale: 'İnsan ilişkileri + yaratıcı anlatı.',
    },
    {
      title: 'Sosyoloji & Medya Çalışmaları',
      rationale: 'Toplumsal dinamikler ve içerik üretimi.',
    },
    {
      title: 'UX Research & Service Design',
      rationale: 'Empati + kullanıcı merkezli tasarım.',
    },
  ],
  SC: [
    {
      title: 'İnsan Kaynakları & Organizasyon',
      rationale: 'İnsan odaklı sistemler ve süreç yönetimi.',
    },
    {
      title: 'Proje Yönetimi',
      rationale: 'Planlama disiplini + ekip koordinasyonu.',
    },
    {
      title: 'Kamu Yönetimi',
      rationale: 'Düzenli prosedürler ve sosyal hizmet.',
    },
  ],
  RC: [
    {
      title: 'İnşaat & Altyapı Mühendisliği',
      rationale: 'Saha uygulaması + standartlara uyum.',
    },
    {
      title: 'Lojistik Mühendisliği',
      rationale: 'Fiziksel operasyon + sistematik planlama.',
    },
    {
      title: 'Üretim Mühendisliği',
      rationale: 'Atölye pratiği + verimlilik odaklı süreçler.',
    },
  ],
  RA: [
    {
      title: 'Mimarlık',
      rationale: 'Teknik çizim + estetik form.',
    },
    {
      title: 'Şehir & Bölge Planlama',
      rationale: 'Altyapı bilgisi + mekânsal tasarım.',
    },
    {
      title: 'Sürdürülebilir Tasarım',
      rationale: 'Uygulamalı mühendislik + yaratıcı çözüm.',
    },
  ],
  RS: [
    {
      title: 'Hemşirelik / Fizyoterapi',
      rationale: 'Pratik beceri + insan bakımı.',
    },
    {
      title: 'Acil Yardım & Sağlık Teknolojileri',
      rationale: 'Saha müdahalesi + prosedürel netlik.',
    },
    {
      title: 'Spor Bilimleri',
      rationale: 'Fiziksel performans + bireysel rehberlik.',
    },
  ],
  RE: [
    {
      title: 'Endüstri Mühendisliği',
      rationale: 'Sistem kurma + saha operasyonu.',
    },
    {
      title: 'Enerji Sistemleri Mühendisliği',
      rationale: 'Teknik altyapı + ticari fizibilite.',
    },
    {
      title: 'Girişim Mühendisliği',
      rationale: 'Prototip + pazara çıkış odaklı hibrit profil.',
    },
  ],
  AC: [
    {
      title: 'Grafik & Görsel İletişim',
      rationale: 'Estetik üretim + marka disiplini.',
    },
    {
      title: 'İç Mimarlık',
      rationale: 'Tasarım + proje yönetimi.',
    },
    {
      title: 'Dijital Medya Prodüksiyonu',
      rationale: 'Yaratıcı içerik + yapılandırılmış teslimat.',
    },
  ],
};

/** 2.–3. eksen ve hibrit motivasyonla beslenen alternatif yollar. */
const SECONDARY_BY_PAIR: Record<string, SampleMajorSuggestion[]> = {
  AS: [
    {
      title: 'Dijital Pazarlama & Growth',
      rationale: 'Yaratıcı deney + veri okuyan kampanya yönetimi.',
    },
    {
      title: 'Oyun Tasarımı & Narrative Design',
      rationale: 'Hikâye anlatımı + sistem düşüncesi.',
    },
  ],
  SI: [
    {
      title: 'Neuroscience & Cognitive Science',
      rationale: 'Sosyal merak + laboratuvar disiplini.',
    },
    {
      title: 'Davranışsal Ekonomi',
      rationale: 'İnsan motivasyonu + analitik modelleme.',
    },
  ],
  CE: [
    {
      title: 'FinTech & Dijital Bankacılık',
      rationale: 'Regülasyon bilgisi + girişimci ürün zihniyeti.',
    },
    {
      title: 'Denetim & Risk Danışmanlığı',
      rationale: 'Süreç güvenliği + müşteri ilişkileri.',
    },
  ],
  AE: [
    {
      title: 'Kültür & Sanat Yönetimi',
      rationale: 'Yaratıcı sektör + organizasyon becerisi.',
    },
    {
      title: 'Film & Medya Yapımı',
      rationale: 'Sanatsal vizyon + prodüksiyon disiplini.',
    },
  ],
  IC: [
    {
      title: 'Siber Güvenlik',
      rationale: 'Analitik derinlik + prosedürel titizlik.',
    },
    {
      title: 'Bioinformatics',
      rationale: 'Veri bilimi + biyolojik sistemler.',
    },
  ],
  SE: [
    {
      title: 'Öğretmenlik & Eğitim Liderliği',
      rationale: 'Rehberlik + etki odaklı kariyer.',
    },
    {
      title: 'NGO & Sivil Toplum Yönetimi',
      rationale: 'Sosyal misyon + operasyonel liderlik.',
    },
  ],
};

function pairKey(a: RiasecCode, b: RiasecCode): string {
  return [a, b].sort().join('');
}

function takeFromLetters(
  letters: RiasecCode[],
  max: number,
  seen: Set<string>,
): SampleMajorSuggestion[] {
  const out: SampleMajorSuggestion[] = [];
  for (const letter of letters) {
    for (const major of MAJORS_BY_LETTER[letter]) {
      if (seen.has(major.title)) continue;
      seen.add(major.title);
      out.push(major);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/**
 * Birincil: 1. ve 2. baskın RIASEC ekseninin kesişimi (2–3 bölüm).
 * İkincil: 2. ve 3. eksen hibritleri + çapraz alternatifler (2–3 bölüm).
 */
export function suggestTieredMajors(
  topLetters: RiasecCode[],
): TieredMajorSuggestions {
  const ranked =
    topLetters.length >= 3
      ? topLetters.slice(0, 3)
      : ([...topLetters, 'I', 'A', 'S'] as RiasecCode[]).slice(0, 3);

  const [first, second, third] = ranked;
  const seen = new Set<string>();

  const primaryKey = pairKey(first, second);
  let primaryMajors = [...(PRIMARY_BY_PAIR[primaryKey] ?? [])].filter((m) => {
    if (seen.has(m.title)) return false;
    seen.add(m.title);
    return true;
  });

  if (primaryMajors.length < 2) {
    primaryMajors.push(...takeFromLetters([first, second], 3, seen));
  }
  primaryMajors = primaryMajors.slice(0, 3);

  const secondaryKey = pairKey(second, third);
  let secondaryMajors = [...(SECONDARY_BY_PAIR[secondaryKey] ?? [])].filter(
    (m) => {
      if (seen.has(m.title)) return false;
      seen.add(m.title);
      return true;
    },
  );

  if (secondaryMajors.length < 2) {
    secondaryMajors.push(...takeFromLetters([second, third], 3, seen));
  }
  secondaryMajors = secondaryMajors.slice(0, 3);

  return { primaryMajors, secondaryMajors };
}

/** Geriye dönük: birincil + ikincil birleşik liste (en fazla 4). */
export function suggestSampleMajors(
  topLetters: RiasecCode[],
): SampleMajorSuggestion[] {
  const { primaryMajors, secondaryMajors } = suggestTieredMajors(topLetters);
  return [...primaryMajors, ...secondaryMajors].slice(0, 4);
}
