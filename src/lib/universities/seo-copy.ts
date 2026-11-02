import type { University } from '@/lib/universities/types';

function formatIelts(band: number | null): string | null {
  if (band === null) return null;
  return band.toFixed(1);
}

function scholarshipSnippet(info: string | null): string {
  const trimmed = info?.trim();
  if (!trimmed) return 'burs ve finansman seçenekleri';
  const firstSentence = trimmed.split(/[.!?\n]/)[0]?.trim();
  if (!firstSentence) return 'burs ve finansman seçenekleri';
  return firstSentence.length > 120
    ? `${firstSentence.slice(0, 117)}…`
    : firstSentence;
}

export function universitySeoTitle(university: University): string {
  return `${university.name} Kabul Şartları, SAT/IELTS & Yaşam Maliyeti | Interscola`;
}

export function universitySeoDescription(university: University): string {
  const reqParts: string[] = [];
  if (university.min_sat_score !== null) {
    reqParts.push(`minimum SAT (${university.min_sat_score})`);
  }
  const ielts = formatIelts(university.min_ielts_band);
  if (ielts) {
    reqParts.push(`IELTS (${ielts})`);
  }

  const reqText =
    reqParts.length > 0
      ? `gereken ${reqParts.join(' ve ')} puanları`
      : 'kabul barajları ve başvuru koşulları';

  const place =
    university.city?.trim() ??
    university.country?.trim() ??
    'yurt dışı';

  const scholarship = scholarshipSnippet(university.scholarship_info);

  return `${university.name} için ${reqText}, ${scholarship} ve ${place} yaşam giderleri rehberi.`;
}

export function universityPagePath(slug: string): string {
  return `/universities/${encodeURIComponent(slug.trim())}`;
}
