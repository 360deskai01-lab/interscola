import type {
  AssessmentScoreMatrix,
  BigFiveKey,
  CognitiveKey,
  RiasecCode,
} from '@/types/assessment';
import { RIASEC_LABELS } from '@/lib/assessment/scoring';

export interface RadarPoint {
  axis: string;
  value: number;
}

const RIASEC_CODES: RiasecCode[] = ['R', 'I', 'A', 'S', 'E', 'C'];

const BIG_FIVE_KEYS: BigFiveKey[] = [
  'openness',
  'discipline',
  'extraversion',
  'focus',
  'stress_tolerance',
];

const COGNITIVE_KEYS: CognitiveKey[] = [
  'analytical',
  'strategic',
  'focus_power',
  'relational',
];

export const BIG_FIVE_RADAR_LABELS: Record<BigFiveKey, string> = {
  openness: 'Açıklık',
  discipline: 'Sorumluluk',
  extraversion: 'Dışadönüklük',
  focus: 'Odak',
  stress_tolerance: 'Stres dayanımı',
};

export const COGNITIVE_RADAR_LABELS: Record<CognitiveKey, string> = {
  analytical: 'Analitik',
  strategic: 'Stratejik',
  focus_power: 'Çalışma belleği',
  relational: 'Sözel / ilişki',
};

/** 0–100; NaN/undefined → 0 */
export function clampPercent(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function normalizeRadarSeries(points: RadarPoint[]): RadarPoint[] {
  return points.map((point) => ({
    axis: point.axis,
    value: clampPercent(point.value),
  }));
}

export function radarSeriesHasSignal(points: RadarPoint[]): boolean {
  return points.some((point) => point.value > 0);
}

export function riasecRadarSeries(
  scores: AssessmentScoreMatrix,
): RadarPoint[] {
  return normalizeRadarSeries(
    RIASEC_CODES.map((letter) => ({
      axis: RIASEC_LABELS[letter],
      value: scores.riasec[letter].percent,
    })),
  );
}

export function bigFiveRadarSeries(
  scores: AssessmentScoreMatrix,
): RadarPoint[] {
  return normalizeRadarSeries(
    BIG_FIVE_KEYS.map((key) => ({
      axis: BIG_FIVE_RADAR_LABELS[key],
      value: scores.bigFive[key].percent,
    })),
  );
}

export function cognitiveRadarSeries(
  scores: AssessmentScoreMatrix,
): RadarPoint[] {
  return normalizeRadarSeries(
    COGNITIVE_KEYS.map((key) => ({
      axis: COGNITIVE_RADAR_LABELS[key],
      value: scores.cognitive[key].percent,
    })),
  );
}

/** Tek grafik alanı: sinyali olan ilk aile (öncelik: RIASEC → Big Five → Bilişsel). */
export function pickPrimaryRadarSeries(
  scores: AssessmentScoreMatrix,
): RadarPoint[] {
  const riasec = riasecRadarSeries(scores);
  if (radarSeriesHasSignal(riasec)) return riasec;

  const bigFive = bigFiveRadarSeries(scores);
  if (radarSeriesHasSignal(bigFive)) return bigFive;

  const cognitive = cognitiveRadarSeries(scores);
  if (radarSeriesHasSignal(cognitive)) return cognitive;

  return riasec;
}
