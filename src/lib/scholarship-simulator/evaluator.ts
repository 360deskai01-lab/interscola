import type {
  ExamStatus,
  EnglishProficiency,
  HighSchoolGpa,
  HouseholdIncomeBand,
  MaxFamilyContribution,
  PropertyOwnership,
  ScholarshipMatch,
  ScholarshipSimulatorInput,
  ScholarshipSimulatorResult,
  StudentsInFamily,
  TargetCountry,
} from '@/lib/scholarship-simulator/types';

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function incomeNeedPoints(band: HouseholdIncomeBand): number {
  switch (band) {
    case 'under_15k':
      return 38;
    case '15_30k':
      return 26;
    case '30_55k':
      return 12;
    case 'over_55k':
      return 0;
  }
}

function propertyNeedPoints(ownership: PropertyOwnership): number {
  switch (ownership) {
    case 'rent':
      return 18;
    case 'one_home':
      return 8;
    case 'multiple':
      return 0;
  }
}

function studentsNeedPoints(count: StudentsInFamily): number {
  switch (count) {
    case '1':
      return 0;
    case '2':
      return 10;
    case '3_plus':
      return 18;
  }
}

function contributionNeedPoints(max: MaxFamilyContribution): number {
  switch (max) {
    case 'under_2k':
      return 16;
    case '2_5k':
      return 10;
    case '5_10k':
      return 4;
    case 'over_10k':
      return 0;
  }
}

function countryNeedModifier(country: TargetCountry): number {
  switch (country) {
    case 'italy':
      return 12;
    case 'germany':
      return 8;
    case 'netherlands':
      return 6;
    case 'uk':
      return 4;
    case 'other_eu':
      return 5;
  }
}

function computeNeedBasedScore(input: ScholarshipSimulatorInput): number {
  const raw =
    incomeNeedPoints(input.householdIncome) +
    propertyNeedPoints(input.propertyOwnership) +
    studentsNeedPoints(input.studentsInFamily) +
    contributionNeedPoints(input.maxFamilyContribution) +
    countryNeedModifier(input.targetCountry);
  return clampScore(raw);
}

function gpaMeritPoints(gpa: HighSchoolGpa): number {
  switch (gpa) {
    case 'below_70':
      return 8;
    case '70_80':
      return 18;
    case '80_90':
      return 32;
    case '90_plus':
      return 42;
  }
}

function examMeritPoints(exam: ExamStatus): number {
  switch (exam) {
    case 'none':
      return 0;
    case 'sat_mid':
      return 18;
    case 'sat_high':
      return 32;
    case 'a_level':
      return 28;
    case 'ib':
      return 30;
  }
}

function englishMeritPoints(level: EnglishProficiency): number {
  switch (level) {
    case 'none':
      return 0;
    case 'ielts_5':
      return 10;
    case 'ielts_6':
      return 20;
    case 'ielts_7_plus':
      return 32;
    case 'toefl_90_plus':
      return 28;
  }
}

function computeMeritBasedScore(input: ScholarshipSimulatorInput): number {
  const raw =
    gpaMeritPoints(input.highSchoolGpa) +
    examMeritPoints(input.examStatus) +
    englishMeritPoints(input.englishProficiency);
  return clampScore(raw);
}

function buildSummary(
  input: ScholarshipSimulatorInput,
  need: number,
  merit: number,
): string {
  const countryLabel =
    input.targetCountry === 'italy'
      ? 'İtalya DSU / ER.GO'
      : input.targetCountry === 'germany'
        ? 'Almanya sosyal katkı ve devlet destekleri'
        : input.targetCountry === 'netherlands'
          ? 'Hollanda merit ve fon programları'
          : 'Avrupa geneli fonlama';

  if (need >= 85 && merit >= 55) {
    return `Profiliniz ${countryLabel} çerçevesinde güçlü bir çift kanallı aday profili sunuyor: gelir ve hane yapısı need-based puanınızı yükseltirken, not ve sınav profiliniz merit tabanlı burslara kapı açıyor. Detaylı evrak ve takvim adımları için portföyünüzü kaydedin.`;
  }
  if (need >= 70) {
    return `Hane geliri, konut durumu ve aile yükü DSU benzeri need-based programlarla yüksek uyum gösteriyor (%${need}). Akademik profiliniz (%${merit}) seçici merit burslarında ek puan sağlayabilir; İtalya ve Almanya hatları öncelikli değerlendirilmeli.`;
  }
  if (merit >= 70) {
    return `Akademik başarı ve dil/sınav profiliniz merit-based burslar için güçlü (%${merit}). Finansal destek puanınız (%${need}) orta bandta; hibrit paketler ve üniversite içi indirimlerle desteklenebilir.`;
  }
  return `Teşhis özeti: finansal destek uygunluğu %${need}, akademik merit %${merit}. Hedef ülke (${countryLabel}) kriterlerine göre önce temel uygunluk adımlarını tamamlamanız, ardından dil ve sınav profilini güçlendirmeniz önerilir.`;
}

function pickMatches(
  input: ScholarshipSimulatorInput,
  need: number,
  merit: number,
): ScholarshipMatch[] {
  const pool: ScholarshipMatch[] = [
    {
      id: 'italy-dsu',
      name: 'İtalya DSU Tam Burs',
      country: 'İtalya',
      institution: 'Politecnico di Milano · DSU',
      fitPercent: clampScore(need + (input.targetCountry === 'italy' ? 8 : 0)),
      tagline: 'ISEE parificato ve hane geliri odaklı tam destek',
    },
    {
      id: 'italy-ergo',
      name: 'ER.GO Bölgesel Destek',
      country: 'İtalya',
      institution: 'Bologna · ER.GO',
      fitPercent: clampScore(need * 0.92 + merit * 0.08),
      tagline: 'Konaklama + yemek + harç indirimi paketi',
    },
    {
      id: 'de-social',
      name: 'Almanya Sosyal Katkı (BAföG benzeri)',
      country: 'Almanya',
      institution: 'Devlet üniversiteleri · sosyal hizmet',
      fitPercent: clampScore(
        need * 0.75 + (input.targetCountry === 'germany' ? 10 : 0),
      ),
      tagline: 'Düşük katkı eşiği ve sosyal danışmanlık hattı',
    },
    {
      id: 'nl-merit',
      name: 'Hollanda Üniversite Merit Bursu',
      country: 'Hollanda',
      institution: 'TU Delft · Excellence Scholarship',
      fitPercent: clampScore(merit + (input.targetCountry === 'netherlands' ? 6 : 0)),
      tagline: 'Not ortalaması + IELTS/SAT eşiği',
    },
    {
      id: 'uk-partial',
      name: 'İngiltere Kısmi Destek / Burs',
      country: 'Birleşik Krallık',
      institution: 'Russell Group · need-aware paketler',
      fitPercent: clampScore(need * 0.45 + merit * 0.55),
      tagline: 'Akademik profil + sınırlı need-based destek',
    },
  ];

  const sorted = [...pool].sort((a, b) => b.fitPercent - a.fitPercent);
  const top = sorted.slice(0, 3);
  if (top.length >= 2) {
    return top;
  }
  return sorted.slice(0, 2);
}

function lockedTeaserFor(input: ScholarshipSimulatorInput): ScholarshipSimulatorResult['lockedTeaser'] {
  const italyFocus = input.targetCountry === 'italy';
  return {
    iseeDocumentList: [
      'ISEE parificato / gelir denklik beyanı (noter onaylı çeviri)',
      'Son 2 yıl vergi beyannamesi ve maaş bordroları',
      'Kira sözleşmesi veya tapu / emlak vergisi özeti',
      'Aile ferdi sayısı ve öğrenci statüsünü gösteren nüfus kayıt örneği',
      italyFocus
        ? 'DSU portalı için İtalya konsolosluğu apostil kontrol listesi'
        : 'Hedef ülkeye göre gelir belgesi apostil paketi',
    ],
    consulateApostilleNotes: [
      'Apostil: Adli sicil, doğum kayıt örneği, noter onaylı tercümeler',
      'Konsolosluk randevusu: evrak seti + DSU/ER.GO portal çıktıları',
      'Veli muvafakatnamesi (18 yaş altı) ve IBAN / SWIFT bilgileri',
    ],
    applicationCalendar: [
      'DSU / ER.GO: genelde Eylül–Kasım portal açılışı (bölgeye göre değişir)',
      'Merit bursları: Ocak–Mart erken başvuru penceresi',
      'Üniversite kabul mektubu sonrası 30 gün içinde evrak tamamlama',
      '2026–27 dönemi için konsolosluk yoğunluğu: Haziran öncesi randevu önerilir',
    ],
  };
}

export function evaluateScholarshipSimulator(
  input: ScholarshipSimulatorInput,
): ScholarshipSimulatorResult {
  const needBasedScore = computeNeedBasedScore(input);
  const meritBasedScore = computeMeritBasedScore(input);
  const summaryParagraph = buildSummary(input, needBasedScore, meritBasedScore);
  const matches = pickMatches(input, needBasedScore, meritBasedScore);

  return {
    needBasedScore,
    meritBasedScore,
    summaryParagraph,
    matches,
    lockedTeaser: lockedTeaserFor(input),
  };
}

/** Audit / regresyon: yüksek need senaryosu (İtalya DSU bandı). */
export const AUDIT_HIGH_NEED_INPUT: ScholarshipSimulatorInput = {
  targetCountry: 'italy',
  householdIncome: 'under_15k',
  propertyOwnership: 'rent',
  studentsInFamily: '3_plus',
  maxFamilyContribution: 'under_2k',
  highSchoolGpa: '80_90',
  examStatus: 'sat_mid',
  englishProficiency: 'ielts_6',
};
