import type { UniversityCatalogEntry } from '@/lib/budget-simulator/types';

/** Ülke bazlı yasal part-time özetleri (bilgilendirme rozeti). */
export function partTimeWorkForCountry(country: string): string | undefined {
  const key = country.trim().toLowerCase();
  if (key.includes('almanya') || key === 'germany') {
    return 'Almanya: Yılda 140 tam gün / Minijob (~€538/ay vergisiz)';
  }
  if (key.includes('italya') || key === 'italy') {
    return 'İtalya: Haftalık azami 20 saat yasal çalışma izni';
  }
  if (key.includes('hollanda') || key === 'netherlands') {
    return 'Hollanda: Haftalık 16 saat veya yazın tam zamanlı';
  }
  if (
    key.includes('ingiltere') ||
    key.includes('birleşik krallık') ||
    key === 'uk' ||
    key.includes('irlanda') ||
    key === 'ireland'
  ) {
    return 'Haftalık 20 saat (dönem içi) / Tatillerde tam zamanlı';
  }
  if (key.includes('avusturya') || key === 'austria') {
    return 'Avusturya: Haftalık 20 saat (AB öğrenci statüsü ile)';
  }
  if (key.includes('polonya') || key === 'poland') {
    return 'Polonya: Dönem içi sınırlı yarı zamanlı çalışma (statüye bağlı)';
  }
  return undefined;
}

/** Slug bazlı çift diploma / özel program rozeti (seed + modal eşlemesi). */
const SPECIAL_PROGRAM_BY_SLUG: Record<string, string> = {
  'bocconi-university': 'Çift Diploma / CEMS & Erasmus+ Staj',
  'tu-munich': 'Çift Diploma / TUM Asia & Sanayi Ortaklığı',
  'politecnico-milano': 'Çift Diploma / PoliMi–PoliTo Çift Derece',
  'tu-delft': 'Çift Diploma / ASML Sanayi Stajı',
};

const PART_TIME_OVERRIDE_BY_SLUG: Record<string, string> = {};

export function enrichUniversityCatalogEntry(
  entry: UniversityCatalogEntry,
): UniversityCatalogEntry {
  const partTimeWork =
    entry.partTimeWork ??
    PART_TIME_OVERRIDE_BY_SLUG[entry.slug] ??
    partTimeWorkForCountry(entry.country);
  const specialProgram =
    entry.specialProgram ?? SPECIAL_PROGRAM_BY_SLUG[entry.slug];

  return {
    ...entry,
    ...(partTimeWork ? { partTimeWork } : {}),
    ...(specialProgram ? { specialProgram } : {}),
  };
}

export function getUniversityDisplayBadges(
  slug: string | null | undefined,
  country: string,
  specialProgramsBadgeFromDb?: string | null,
): { partTimeWork?: string; specialProgram?: string } {
  const normalizedSlug = slug?.trim() ?? '';
  const fromDb = specialProgramsBadgeFromDb?.trim();
  const specialProgram =
    fromDb ||
    (normalizedSlug ? SPECIAL_PROGRAM_BY_SLUG[normalizedSlug] : undefined);
  const partTimeWork =
    (normalizedSlug ? PART_TIME_OVERRIDE_BY_SLUG[normalizedSlug] : undefined) ??
    partTimeWorkForCountry(country);

  return {
    ...(partTimeWork ? { partTimeWork } : {}),
    ...(specialProgram ? { specialProgram } : {}),
  };
}

export const BUDGET_PART_TIME_TIP_PILL =
  '💡 İpucu: Avrupa\'da yasal part-time çalışma izniniz sayesinde aylık bütçenize ortalama €450 - €600 ek destek sağlayabilirsiniz.';
