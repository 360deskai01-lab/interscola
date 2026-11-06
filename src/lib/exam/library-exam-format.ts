import {
  DIAGNOSTIC_DRILL_DURATION_MINUTES,
  MINI_MOCK_DURATION_MINUTES,
} from '@/lib/exam/exam-session-formats';

/**
 * `public.libraries.exam_format` — kütüphane kartının kalıcı sınıflandırması.
 * Oturum formatı (`ExamSessionFormatId`) ile karıştırılmamalı: o, oturum başlarken
 * soru sayısını kırpar; bu ise kartın hangi sekmede listeleneceğini belirler.
 */
export type LibraryExamFormat = 'drill' | 'mini_mock' | 'full_mock';

export type LibraryExploreMode = 'quick' | 'full';

/** Resmi tam simülasyon için alt süre sınırı (dk). */
export const FULL_MOCK_MIN_DURATION_MINUTES = 120;

/** Satırdaki soru sayısı bu değerin üstündeyse DB alanı yokken tam simülasyon varsayılır. */
const FULL_MOCK_INFERENCE_THRESHOLD = 20;
const MINI_MOCK_INFERENCE_THRESHOLD = 8;

export function parseLibraryExamFormat(raw: unknown): LibraryExamFormat | null {
  return raw === 'drill' || raw === 'mini_mock' || raw === 'full_mock'
    ? raw
    : null;
}

/**
 * Migration uygulanmamış ortamlarda `exam_format` sütunu yoktur; soru sayısından çıkarım yapılır.
 */
export function inferLibraryExamFormat(
  questionCount: number | null,
): LibraryExamFormat {
  if (questionCount !== null && questionCount >= FULL_MOCK_INFERENCE_THRESHOLD) {
    return 'full_mock';
  }
  if (questionCount !== null && questionCount >= MINI_MOCK_INFERENCE_THRESHOLD) {
    return 'mini_mock';
  }
  return 'drill';
}

export function resolveLibraryExamFormat(
  stored: unknown,
  questionCount: number | null,
): LibraryExamFormat {
  return parseLibraryExamFormat(stored) ?? inferLibraryExamFormat(questionCount);
}

export function exploreModeForFormat(format: LibraryExamFormat): LibraryExploreMode {
  return format === 'full_mock' ? 'full' : 'quick';
}

/** Kartta gösterilecek süre (dk). Tam simülasyonda payload süresi, alt sınırın altına düşmez. */
export function displayDurationMinutes(
  format: LibraryExamFormat,
  payloadDurationMinutes: number | null,
): number {
  if (format === 'full_mock') {
    return Math.max(
      payloadDurationMinutes ?? 0,
      FULL_MOCK_MIN_DURATION_MINUTES,
    );
  }
  return format === 'mini_mock'
    ? MINI_MOCK_DURATION_MINUTES
    : DIAGNOSTIC_DRILL_DURATION_MINUTES;
}
