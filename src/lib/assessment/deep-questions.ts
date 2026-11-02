import type { AssessmentKind, AssessmentQuestion } from '@/types/assessment';

export const DEEP_RIASEC_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'dr-r1',
    prompt: 'Atölye, laboratuvar veya saha çalışması beni masa başı teori kadar tatmin eder.',
    dimension: { family: 'riasec', code: 'R' },
  },
  {
    id: 'dr-r2',
    prompt: 'Mekanik veya teknik sistemlerin nasıl çalıştığını anlamak için uğraşırım.',
    dimension: { family: 'riasec', code: 'R' },
  },
  {
    id: 'dr-i1',
    prompt: 'Akademik makale veya rapor okuyup sentezlemekten keyif alırım.',
    dimension: { family: 'riasec', code: 'I' },
  },
  {
    id: 'dr-i2',
    prompt: 'Hipotez kurup test etmek benim doğal düşünme tarzım.',
    dimension: { family: 'riasec', code: 'I' },
  },
  {
    id: 'dr-a1',
    prompt: 'Sunum ve portfolyo tasarımı performansımı yansıtır.',
    dimension: { family: 'riasec', code: 'A' },
  },
  {
    id: 'dr-s1',
    prompt: 'Gönüllülük veya mentorluk deneyimlerim anlamlı gelir.',
    dimension: { family: 'riasec', code: 'S' },
  },
  {
    id: 'dr-e1',
    prompt: 'Kulüp, girişim veya liderlik rollerinde sorumluluk alırım.',
    dimension: { family: 'riasec', code: 'E' },
  },
  {
    id: 'dr-c1',
    prompt: 'Finansal veya operasyonel düzen kurmak beni rahatlatır.',
    dimension: { family: 'riasec', code: 'C' },
  },
  {
    id: 'dr-i3',
    prompt: 'STEM problemlerinde sistematik yaklaşım kullanırım.',
    dimension: { family: 'riasec', code: 'I' },
  },
  {
    id: 'dr-e2',
    prompt: 'Networking ve ikna becerilerimi geliştirmeye zaman ayırırım.',
    dimension: { family: 'riasec', code: 'E' },
  },
  {
    id: 'dr-a2',
    prompt: 'Disiplinler arası yaratıcı projeler ilgimi çeker.',
    dimension: { family: 'riasec', code: 'A' },
  },
  {
    id: 'dr-c2',
    prompt: 'Check-list ve Gantt tarzı planlama araçları kullanırım.',
    dimension: { family: 'riasec', code: 'C' },
  },
];

export const DEEP_BIG_FIVE_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'db-d1',
    prompt: 'Günlük tekrar rutinlerim (flashcard, soru bankası) disiplinimi destekler.',
    dimension: { family: 'big_five', key: 'discipline' },
  },
  {
    id: 'db-d2',
    prompt: 'Hedeflediğim haftalık soru kotasını genelde tuttururum.',
    dimension: { family: 'big_five', key: 'discipline' },
  },
  {
    id: 'db-f1',
    prompt: 'Pomodoro veya benzeri tekniklerle odaklanmayı yönetirim.',
    dimension: { family: 'big_five', key: 'focus' },
  },
  {
    id: 'db-f2',
    prompt: 'Uzun okuma parçalarında not alarak aktif okurum.',
    dimension: { family: 'big_five', key: 'focus' },
  },
  {
    id: 'db-st1',
    prompt: 'Mock sınav sonuçları beni motive eder, paniğe kapılmam.',
    dimension: { family: 'big_five', key: 'stress_tolerance' },
  },
  {
    id: 'db-st2',
    prompt: 'Yoğun dönemlerde uyku ve beslenme düzenimi korumaya çalışırım.',
    dimension: { family: 'big_five', key: 'stress_tolerance' },
  },
  {
    id: 'db-e1',
    prompt: 'Study group liderliği veya sunum yapmak bana uygun.',
    dimension: { family: 'big_five', key: 'extraversion' },
  },
  {
    id: 'db-e2',
    prompt: 'Yeni kampüs/sınıf ortamlarına hızlı uyum sağlarım.',
    dimension: { family: 'big_five', key: 'extraversion' },
  },
  {
    id: 'db-o1',
    prompt: 'Seçmeli ders ve yurt dışı programları keşfetmeyi severim.',
    dimension: { family: 'big_five', key: 'openness' },
  },
  {
    id: 'db-o2',
    prompt: 'Farklı sınav formatlarını (SAT, IELTS, CAIE) denemekten çekinmem.',
    dimension: { family: 'big_five', key: 'openness' },
  },
  {
    id: 'db-d3',
    prompt: 'Çalışma alanımı düzenli tutmak konsantrasyonuma yardım eder.',
    dimension: { family: 'big_five', key: 'discipline' },
  },
  {
    id: 'db-st3',
    prompt: 'Geribildirim aldığımda savunmaya geçmeden uygulamaya çalışırım.',
    dimension: { family: 'big_five', key: 'stress_tolerance' },
  },
];

export const DEEP_COGNITIVE_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'dc-an1',
    prompt: 'Grafik ve tablo yorumlama sorularında güçlüyüm.',
    dimension: { family: 'cognitive', key: 'analytical' },
  },
  {
    id: 'dc-an2',
    prompt: 'Kanıt zinciri kurarak essay yazmayı severim.',
    dimension: { family: 'cognitive', key: 'analytical' },
  },
  {
    id: 'dc-str1',
    prompt: 'Üniversite hedeflerime göre 6 aylık çalışma planı yapabilirim.',
    dimension: { family: 'cognitive', key: 'strategic' },
  },
  {
    id: 'dc-str2',
    prompt: 'Zayıf konulara ekstra slot ayırarak denge kurarım.',
    dimension: { family: 'cognitive', key: 'strategic' },
  },
  {
    id: 'dc-fo1',
    prompt: 'Full-length deneme sırasında zaman yönetimimi korurum.',
    dimension: { family: 'cognitive', key: 'focus_power' },
  },
  {
    id: 'dc-fo2',
    prompt: 'Dikkat dağıtıcı ortamda bile kritik sorulara odaklanırım.',
    dimension: { family: 'cognitive', key: 'focus_power' },
  },
  {
    id: 'dc-re1',
    prompt: 'Öğretmen/mentor ile hedef görüşmelerinde net sorular sorarım.',
    dimension: { family: 'cognitive', key: 'relational' },
  },
  {
    id: 'dc-re2',
    prompt: 'Akran çalışmasında bilgi paylaşımını teşvik ederim.',
    dimension: { family: 'cognitive', key: 'relational' },
  },
  {
    id: 'dc-an3',
    prompt: 'Hata analizi (error log) tutarak tekrar eden hataları azaltırım.',
    dimension: { family: 'cognitive', key: 'analytical' },
  },
  {
    id: 'dc-str3',
    prompt: 'Early decision / rolling başvuru takvimlerini stratejik okurum.',
    dimension: { family: 'cognitive', key: 'strategic' },
  },
  {
    id: 'dc-fo3',
    prompt: 'Uzun matematik çözümünde ara adımları kontrol ederim.',
    dimension: { family: 'cognitive', key: 'focus_power' },
  },
  {
    id: 'dc-re3',
    prompt: 'Kültürler arası ekip projelerinde köprü rolü üstlenirim.',
    dimension: { family: 'cognitive', key: 'relational' },
  },
];

export function getDeepQuestions(kind: AssessmentKind): AssessmentQuestion[] {
  switch (kind) {
    case 'deep_riasec':
      return DEEP_RIASEC_QUESTIONS;
    case 'deep_big_five':
      return DEEP_BIG_FIVE_QUESTIONS;
    case 'deep_cognitive':
      return DEEP_COGNITIVE_QUESTIONS;
    default:
      return [];
  }
}

export const DEEP_ASSESSMENT_META: {
  kind: AssessmentKind;
  title: string;
  description: string;
}[] = [
  {
    kind: 'deep_riasec',
    title: 'Derin RIASEC Profili',
    description: 'Holland boyutlarında 12 maddelik genişletilmiş envanter.',
  },
  {
    kind: 'deep_big_five',
    title: 'Derin Kişilik & Çalışma Stili',
    description: 'Disiplin, odak, stres toleransı ve deneyime açıklık derinlemesi.',
  },
  {
    kind: 'deep_cognitive',
    title: 'Derin Bilişsel Güçler',
    description: 'Analitik, stratejik, odak ve ilişki kurma profiliniz.',
  },
];
