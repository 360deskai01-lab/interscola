import type { AssessmentQuestion } from '@/types/assessment';

/** Hızlı Kombo Pusula — 24 soru (8 RIASEC + 8 Big Five + 8 Bilişsel). */
export const QUICK_COMBO_QUESTIONS: AssessmentQuestion[] = [
  // RIASEC ×8
  {
    id: 'qc-r1',
    prompt: 'Somut projelerde ellerimle veya teknik araçlarla çalışmak beni motive eder.',
    dimension: { family: 'riasec', code: 'R' },
  },
  {
    id: 'qc-r2',
    prompt: 'Net talimatlar ve uygulanabilir adımlar içeren görevlerde daha verimliyim.',
    dimension: { family: 'riasec', code: 'R' },
  },
  {
    id: 'qc-i1',
    prompt: 'Karmaşık bir konuyu veri ve mantıkla çözene kadar araştırmayı severim.',
    dimension: { family: 'riasec', code: 'I' },
  },
  {
    id: 'qc-i2',
    prompt: '“Neden?” sorusunu sormadan yeni bir fikri kabul etmem.',
    dimension: { family: 'riasec', code: 'I' },
  },
  {
    id: 'qc-a1',
    prompt: 'Özgün fikirler üretmek ve estetik sunum yapmak benim için keyifli.',
    dimension: { family: 'riasec', code: 'A' },
  },
  {
    id: 'qc-s1',
    prompt: 'İnsanlara rehberlik etmek ve onların gelişimini görmek beni tatmin eder.',
    dimension: { family: 'riasec', code: 'S' },
  },
  {
    id: 'qc-e-r',
    prompt: 'Fikirleri satmak, ikna etmek veya proje yönetmek beni heyecanlandırır.',
    dimension: { family: 'riasec', code: 'E' },
  },
  {
    id: 'qc-c-r',
    prompt: 'Düzenli kayıt tutmak, kurallara uymak ve süreçleri standartlaştırmak bana uygun.',
    dimension: { family: 'riasec', code: 'C' },
  },
  // Big Five ×8
  {
    id: 'qc-d1',
    prompt: 'Haftalık çalışma planıma sadık kalmak benim için doğal bir alışkanlık.',
    dimension: { family: 'big_five', key: 'discipline' },
  },
  {
    id: 'qc-d2',
    prompt: 'Ertelemeden, teslim tarihinden önce görevleri tamamlamaya özen gösteririm.',
    dimension: { family: 'big_five', key: 'discipline' },
  },
  {
    id: 'qc-f1',
    prompt: 'Uzun süre dikkatimi tek bir akademik göreve verebilirim.',
    dimension: { family: 'big_five', key: 'focus' },
  },
  {
    id: 'qc-f2',
    prompt: 'Ders çalışırken telefon veya bildirimlerden kolayca izole olurum.',
    dimension: { family: 'big_five', key: 'focus' },
  },
  {
    id: 'qc-st1',
    prompt: 'Sınav veya sunum baskısı altında performansım genelde düşmez.',
    dimension: { family: 'big_five', key: 'stress_tolerance' },
  },
  {
    id: 'qc-st2',
    prompt: 'Belirsiz durumlarda sakin kalıp çözüm aramayı başarıyorum.',
    dimension: { family: 'big_five', key: 'stress_tolerance' },
  },
  {
    id: 'qc-e1',
    prompt: 'Yeni insanlarla tanışmak ve fikir alışverişi yapmak bana enerji verir.',
    dimension: { family: 'big_five', key: 'extraversion' },
  },
  {
    id: 'qc-o1',
    prompt: 'Farklı kültürler, disiplinler ve bakış açıları beni heyecanlandırır.',
    dimension: { family: 'big_five', key: 'openness' },
  },
  // Bilişsel ×8
  {
    id: 'qc-an1',
    prompt: 'Sayısal ve mantıksal bulmacaları çözmekten hoşlanırım.',
    dimension: { family: 'cognitive', key: 'analytical' },
  },
  {
    id: 'qc-an2',
    prompt: 'Bir argümandaki varsayımları hızlıca fark ederim.',
    dimension: { family: 'cognitive', key: 'analytical' },
  },
  {
    id: 'qc-str1',
    prompt: 'Uzun vadeli hedefler için adım adım strateji kurarım.',
    dimension: { family: 'cognitive', key: 'strategic' },
  },
  {
    id: 'qc-str2',
    prompt: 'Kaynaklarımı (zaman, enerji) önceliklere göre dağıtırım.',
    dimension: { family: 'cognitive', key: 'strategic' },
  },
  {
    id: 'qc-fo1',
    prompt: 'Detay gerektiren okuma parçalarında dikkatim dağılmaz.',
    dimension: { family: 'cognitive', key: 'focus_power' },
  },
  {
    id: 'qc-fo2',
    prompt: 'Tekrar ve aralıklı tekrar (spaced repetition) bana uygun gelir.',
    dimension: { family: 'cognitive', key: 'focus_power' },
  },
  {
    id: 'qc-re1',
    prompt: 'Grup çalışmalarında farklı görüşleri uzlaştırmayı başarıyorum.',
    dimension: { family: 'cognitive', key: 'relational' },
  },
  {
    id: 'qc-re2',
    prompt: 'Mentor veya akran geri bildirimini gelişim için aktif kullanırım.',
    dimension: { family: 'cognitive', key: 'relational' },
  },
];

export { calculateScores } from '@/lib/assessment/scoring';
