import type { AssessmentScoreMatrix, RiasecCode } from '@/types/assessment';

const BIG_FIVE_KEYS = [
  'discipline',
  'focus',
  'stress_tolerance',
  'extraversion',
  'openness',
] as const;

const BIG_FIVE_LABELS: Record<(typeof BIG_FIVE_KEYS)[number], string> = {
  discipline: 'Disiplin',
  focus: 'Odak',
  stress_tolerance: 'Stres dayanımı',
  extraversion: 'Sosyallik',
  openness: 'Deneyime açıklık',
};

const COGNITIVE_KEYS = [
  'analytical',
  'strategic',
  'focus_power',
  'relational',
] as const;

const VIA_COGNITIVE_LABELS: Record<(typeof COGNITIVE_KEYS)[number], string> = {
  analytical: 'Analitik düşünme (VIA)',
  strategic: 'Stratejik planlama (VIA)',
  focus_power: 'Odak gücü (VIA)',
  relational: 'İlişki kurma (VIA)',
};

function bandLabel(percent: number): string {
  if (percent >= 70) return 'Yüksek';
  if (percent >= 45) return 'Dengeli';
  return 'Gelişim alanı';
}

export function formatRiasecDominantCodes(codes: RiasecCode[]): string {
  const top = codes.slice(0, 3);
  if (top.length === 0) return '—';
  return top.join('-');
}

export function summarizeBigFiveBalance(scores: AssessmentScoreMatrix): string {
  const ranked = [...BIG_FIVE_KEYS].sort(
    (a, b) => scores.bigFive[b].percent - scores.bigFive[a].percent,
  );
  const high = ranked[0];
  const low = ranked[ranked.length - 1];
  if (!high || !low) return 'Big Five özeti henüz oluşmadı.';
  return `${BIG_FIVE_LABELS[high]}: ${bandLabel(scores.bigFive[high].percent)} · ${BIG_FIVE_LABELS[low]}: ${bandLabel(scores.bigFive[low].percent)}`;
}

export function extractViaCognitiveStrengths(
  scores: AssessmentScoreMatrix,
  limit = 3,
): string[] {
  const ranked = [...COGNITIVE_KEYS].sort(
    (a, b) => scores.cognitive[b].percent - scores.cognitive[a].percent,
  );
  const out: string[] = [];
  for (const key of ranked) {
    if (scores.cognitive[key].percent <= 0) continue;
    out.push(VIA_COGNITIVE_LABELS[key]);
    if (out.length >= limit) break;
  }
  return out;
}
