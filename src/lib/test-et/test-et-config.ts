import type { CurriculumCode } from '@/types/exam';

export const TEST_ET_SLUGS = ['sat', 'ielts', 'a-level'] as const;

export type TestEtSlug = (typeof TEST_ET_SLUGS)[number];

export function isTestEtSlug(value: string): value is TestEtSlug {
  return (TEST_ET_SLUGS as readonly string[]).includes(value);
}

/** Tek doğru kaynak: slug ↔ müfredat (CAIE ↔ a-level). */
export function curriculumForTestEtSlug(slug: TestEtSlug): CurriculumCode {
  if (slug === 'a-level') {
    return 'CAIE';
  }
  if (slug === 'sat') {
    return 'SAT';
  }
  if (slug === 'ielts') {
    return 'IELTS';
  }
  const _exhaustive: never = slug;
  return _exhaustive;
}

export function testEtSlugForCurriculum(
  curriculum: CurriculumCode,
): TestEtSlug | null {
  if (curriculum === 'CAIE') {
    return 'a-level';
  }
  if (curriculum === 'SAT') {
    return 'sat';
  }
  if (curriculum === 'IELTS') {
    return 'ielts';
  }
  return null;
}

export function isCaieTestEtContext(input: {
  slug?: TestEtSlug | string;
  curriculum?: CurriculumCode | string;
}): boolean {
  if (input.slug === 'a-level') return true;
  const code = input.curriculum?.toString().trim().toUpperCase();
  return code === 'CAIE' || code === 'A_LEVEL' || code === 'A-LEVEL';
}

export function testEtHref(slug: TestEtSlug): string {
  return `/test-et/${slug}`;
}

export type TestEtVitrineContent = {
  slug: TestEtSlug;
  badgeLabel: string;
  headline: string;
  subtitle: string;
  durationLabel: string;
  scoreScaleLabel: string;
  methodology: string;
  measuredSkills: string[];
};

export const TEST_ET_VITRINE: Record<TestEtSlug, TestEtVitrineContent> = {
  sat: {
    slug: 'sat',
    badgeLabel: 'Digital SAT',
    headline: 'Digital SAT Hızlı Seviye Tespiti',
    subtitle: 'Math & Reading — College Board mantığına yakın kısa OBJECTIVE teşhis',
    durationLabel: '15 Dakika',
    scoreScaleLabel: 'Tahmini skor: /1600 ölçeği',
    methodology:
      'Resmi tohum `exam_payload` ile çalışır; adaptif LLM üretimi yoktur. Okuma/Yazma Craft & Structure ve temel cebir sorularıyla hızlı performans profili çıkarılır. Sonuç ekranı yaklaşık skor projeksiyonu sunar; resmî SAT skoru değildir.',
    measuredSkills: [
      'Cebir ve denklem çözme',
      'Okuma & anlam (Craft and Structure)',
      'Mantıksal çıkarım',
      'Zaman yönetimi (15 dk)',
    ],
  },
  ielts: {
    slug: 'ielts',
    badgeLabel: 'IELTS Academic',
    headline: 'IELTS Academic Dil Seviye Tespiti',
    subtitle: 'Writing Task 2 odaklı LANGUAGE motoru teşhisi',
    durationLabel: '15 Dakika',
    scoreScaleLabel: 'Tahmini sonuç: Band ölçeği',
    methodology:
      'Doğrulanmış açık kütüphane kaydındaki Task 2 promptu ile rubrik mantığına yakın geri bildirim üretilir. British Council / IDP ile bağlantımız yoktur; hazırlık amaçlı band tahminidir.',
    measuredSkills: [
      'Task Achievement / görev yanıtı',
      'Coherence & Cohesion',
      'Lexical Resource',
      'Grammatical Range & Accuracy',
    ],
  },
  'a-level': {
    slug: 'a-level',
    badgeLabel: 'Cambridge CAIE',
    headline: 'Cambridge A-Level Akademik Yeterlilik',
    subtitle: 'Psychology 9990 — AO1 / AO2 / AO3 rubrik teşhisi',
    durationLabel: '15–20 Dakika',
    scoreScaleLabel: 'Tahmini sonuç: Harf notu (Grade) özeti',
    methodology:
      'CAIE RUBRIC_ESSAY motoru; çoktan seçmeli, yapılandırılmış yanıt ve uzun değerlendirme sorusu bir arada. Andrade (2010) doodling senaryosu üzerinden bilgi, uygulama ve değerlendirme becerileri ölçülür.',
    measuredSkills: [
      'AO1 — Bilgi ve anlama',
      'AO2 — Uygulama ve analiz',
      'AO3 — Değerlendirme',
      'Akademik yazım disiplini',
    ],
  },
};
