export const HELP_CATEGORY_IDS = [
  'all',
  'student',
  'teacher',
  'org',
  'billing',
] as const;

export type HelpCategoryId = (typeof HELP_CATEGORY_IDS)[number];

export type HelpFaqItem = {
  id: string;
  question: string;
  answer: string;
  categories: Exclude<HelpCategoryId, 'all'>[];
  keywords: string[];
};

export const HELP_CATEGORY_LABELS: Record<HelpCategoryId, string> = {
  all: 'Tümü',
  student: 'Öğrenci & Sınavlar',
  teacher: 'Öğretmen & Ödev',
  org: 'Kurum & Lisans',
  billing: 'Paketler & Ödeme',
};

export const HELP_FAQ_ITEMS: HelpFaqItem[] = [
  {
    id: 'diagnostic',
    question: 'Teşhis sınavı nasıl çalışır?',
    answer:
      'Keşfet sekmesinden veya atanan materyallerden kısa bir teşhis denemesi başlatabilirsiniz. Motor, yanıtlarınıza göre konu dağılımını ölçer ve sonuç ekranında güçlü/zayıf alan özeti sunar. Tam skor resmi sınav kurumlarının resmi dönüşüm tablolarının yerini tutmaz; yaklaşık ölçeklerdir.',
    categories: ['student'],
    keywords: ['teşhis', 'diagnostic', 'seviye', 'explore'],
  },
  {
    id: 'link-teacher',
    question: 'Öğretmenimi nasıl bağlarım?',
    answer:
      'Öğrenci panelinde “Öğretmen bağla” alanına öğretmeninizin paylaştığı davet kodunu girin. Kod doğrulandığında bağlantı aktif olur ve öğretmen atadığı materyalleri görebilirsiniz. Bağlantı yalnızca onaylı öğretmen hesaplarıyla kurulur.',
    categories: ['student', 'teacher'],
    keywords: ['davet', 'kod', 'bağlantı', 'teacher'],
  },
  {
    id: 'org-code',
    question: 'Kurum kodunu nereye girmeliyim?',
    answer:
      'Onaylı öğrenci panelinde hedefler / kurum bölümünde “Kurum kodu ile katıl” alanını kullanın. Kod, okul veya kurs merkezinizin yöneticisi tarafından verilir. Kod geçersizse kurum adınızı ve kodu destek ekibine iletin.',
    categories: ['org', 'student'],
    keywords: ['kurum', 'okul', 'join', 'organizasyon'],
  },
  {
    id: 'ielts-scoring',
    question: 'IELTS puanlaması platformda nasıl yapılır?',
    answer:
      'IELTS Academic modüllerinde açık uçlu ve yapılandırılmış yanıtlar rubrik mantığına göre değerlendirilir; band ölçeğine yakın geri bildirim üretilir. British Council veya IDP ile doğrudan bağlantımız yoktur; sonuçlar hazırlık amaçlıdır.',
    categories: ['student'],
    keywords: ['ielts', 'band', 'rubrik', 'yazma', 'konuşma'],
  },
  {
    id: 'sat-scoring',
    question: 'Digital SAT puanlaması nasıl çalışır?',
    answer:
      'Digital SAT denemelerinde bölüm bazlı ham performans ve ölçeklenmiş skor projeksiyonu gösterilir. Adaptif pratik setleri performansınıza göre zorluk dağılımını ayarlar. College Board tescilli markasıdır; resmî SAT skoru değildir.',
    categories: ['student'],
    keywords: ['sat', 'digital', 'college board', 'skor'],
  },
  {
    id: 'assignments',
    question: 'Öğretmen ödevi nasıl tamamlanır?',
    answer:
      'Panelinizde “Atamalar” listesinden materyali açın; okuma modunda bitirdikten sonra durumu güncelleyin veya sınav atamasıysa exam-session akışına yönlendirilirsiniz. Tamamlama durumu öğretmen paneline yansır.',
    categories: ['student', 'teacher'],
    keywords: ['ödev', 'atama', 'assignment', 'materyal'],
  },
  {
    id: 'library-teacher',
    question: 'Öğretmen kütüphane ve sınav sentezi nasıl kullanılır?',
    answer:
      'Öğretmen panelinde kütüphane bölümünden materyal yükleyebilir, öğrenciye atayabilir ve gerektiğinde sentez denemesi oluşturabilirsiniz. Tüm atamalar bağlı öğrenci hesaplarıyla eşleşir; yetki sunucu tarafında doğrulanır.',
    categories: ['teacher'],
    keywords: ['kütüphane', 'sentez', 'library', 'sınav üret'],
  },
  {
    id: 'career-compass',
    question: 'Kariyer pusulası sonuçlarım kaybolur mu?',
    answer:
      'Misafirken çözdüğünüz testler tarayıcıda misafir oturum kimliği ile saklanır; kayıt olduktan sonra öğrenci paneline girdiğinizde sonuçlar hesabınıza aktarılır (claim). Giriş yapmışken çözdüğünüz testler doğrudan profilinize yazılır.',
    categories: ['student'],
    keywords: ['kariyer', 'pusula', 'holland', 'misafir'],
  },
  {
    id: 'pricing-trial',
    question: 'Deneme paketi (15 gün) neleri kapsar?',
    answer:
      'Deneme katmanı platformu sınırlı süreyle keşfetmenizi sağlar: temel teşhis, kariyer pusulası hızlı kombo ve üniversite rehberi okuma. Tam motor erişimi ve kurumsal özellikler ücretli paketlerle açılır; güncel kapsam /pricing sayfasındadır.',
    categories: ['billing', 'student'],
    keywords: ['deneme', 'ücretsiz', 'paket', '15 gün'],
  },
  {
    id: 'corporate-license',
    question: 'Okul veya kurs merkezi lisansı nasıl alınır?',
    answer:
      'Kurumsal paketler için iletişim formundan “Kurumsal Lisans / Demo” konusunu seçerek talep gönderin. Ekibimiz kampüs büyüklüğü, şube sayısı ve kullanım senaryosuna göre teklif paylaşır.',
    categories: ['org', 'billing'],
    keywords: ['lisans', 'okul', 'kurum', 'demo', 'enterprise'],
  },
];

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

export function faqMatchesSearch(item: HelpFaqItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    item.question,
    item.answer,
    ...item.keywords,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export function faqMatchesCategory(
  item: HelpFaqItem,
  category: HelpCategoryId,
): boolean {
  if (category === 'all') return true;
  return item.categories.includes(category);
}
