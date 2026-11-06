import type { CurriculumCode } from '@/types/exam';

/** PDF yükleme üst sınırı (bayt). `next.config.ts` bodySizeLimit bunun üstünde olmalı. */
export const STUDIO_MAX_PDF_BYTES = 4 * 1024 * 1024;

/** Modele gönderilecek metin üst sınırı (route.ts 15.000 karaktere kırpar). */
export const STUDIO_MAX_MATERIAL_CHARS = 15_000;

/** Kaliteli soru üretimi için asgari metin. */
export const STUDIO_MIN_MATERIAL_CHARS = 120;

/** LLM maliyet koruması: öğrenci başına saatlik özel sınav üretim sınırı. */
export const STUDIO_MAX_UPLOADS_PER_HOUR = 6;

export type StudioScope = 'quick' | 'comprehensive';

export const STUDIO_CURRICULA: readonly {
  id: CurriculumCode;
  label: string;
  hint: string;
}[] = [
  { id: 'SAT', label: 'Digital SAT', hint: 'Çoktan seçmeli · Reading & Writing / Math' },
  { id: 'IELTS', label: 'IELTS Academic', hint: 'Akademik yazma görevi · band değerlendirme' },
  { id: 'CAIE', label: 'CAIE A-Level', hint: 'Rubrikli essay · A-Level notlandırma' },
];

export function parseStudioCurriculum(raw: unknown): CurriculumCode | null {
  return raw === 'SAT' || raw === 'IELTS' || raw === 'CAIE' ? raw : null;
}

export function parseStudioScope(raw: unknown): StudioScope | null {
  return raw === 'quick' || raw === 'comprehensive' ? raw : null;
}
